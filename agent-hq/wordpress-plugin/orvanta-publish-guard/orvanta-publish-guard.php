<?php
/**
 * Plugin Name:       Orvanta Publish Guard
 * Description:       Nothing goes live without Orvanta's OK. Every publish request (REST API, editor, XML-RPC) is checked with Orvanta first; posts that need a human decision wait as "Pending" and go live once approved. If Orvanta can't be reached, nothing is published.
 * Version:           0.1.2
 * Requires at least: 5.6
 * Requires PHP:      7.4
 * Author:            Orvanta
 * Author URI:        https://orvantahq.io
 * License:           GPL-2.0-or-later
 * Text Domain:       orvanta-publish-guard
 */

if (!defined('ABSPATH')) {
	exit;
}

final class Orvanta_Publish_Guard {
	const VERSION = '0.1.2';
	const UPDATE_URL = 'https://orvantahq.io/downloads/orvanta-publish-guard.json';
	const OPT = 'orvanta_publish_guard';
	const CRON = 'orvanta_publish_guard_poll';
	const META_APPROVAL = '_orvanta_approval_id';
	const META_TARGET = '_orvanta_target_status';
	const META_STATE = '_orvanta_state';
	const META_REASON = '_orvanta_reason';
	const META_CHECKED = '_orvanta_checked_at';
	const META_HASH = '_orvanta_content_hash';

	/** Set while the plugin itself publishes an approved post, so its own update isn't held again. */
	private static $bypass = false;
	/** The outcome of the last check, saved on the post once WordPress has given it an ID. */
	private static $last = null;

	public static function init() {
		add_filter('wp_insert_post_data', array(__CLASS__, 'guard'), 99, 2);
		add_action('wp_insert_post', array(__CLASS__, 'remember'), 10, 1);
		add_action('rest_api_init', array(__CLASS__, 'routes'));
		add_filter('cron_schedules', array(__CLASS__, 'schedules'));
		add_action(self::CRON, array(__CLASS__, 'poll'));
		add_action('admin_menu', array(__CLASS__, 'menu'));
		add_action('admin_init', array(__CLASS__, 'register_settings'));
		add_action('admin_notices', array(__CLASS__, 'notice'));
		add_action('admin_post_orvanta_test', array(__CLASS__, 'test_connection'));
		add_action('admin_post_orvanta_recheck', array(__CLASS__, 'recheck_now'));
		add_filter('pre_set_site_transient_update_plugins', array(__CLASS__, 'check_update'));
		add_filter('plugins_api', array(__CLASS__, 'update_details'), 10, 3);
		register_activation_hook(__FILE__, array(__CLASS__, 'activate'));
		register_deactivation_hook(__FILE__, array(__CLASS__, 'deactivate'));
	}

	// ---------- settings ----------

	public static function opts() {
		$o = get_option(self::OPT, array());
		return wp_parse_args(is_array($o) ? $o : array(), array(
			'api_url' => 'https://app.orvantahq.io',
			'api_key' => '',
			'users' => '',
			'post_types' => 'post',
			'secret' => '',
		));
	}

	public static function activate() {
		$o = self::opts();
		if ($o['secret'] === '') {
			$o['secret'] = wp_generate_password(40, false, false);
			update_option(self::OPT, $o, false);
		}
		if (!wp_next_scheduled(self::CRON)) {
			wp_schedule_event(time() + 60, 'orvanta_five_minutes', self::CRON);
		}
	}

	public static function deactivate() {
		wp_clear_scheduled_hook(self::CRON);
	}

	public static function schedules($s) {
		$s['orvanta_five_minutes'] = array('interval' => 300, 'display' => 'Every 5 minutes (Orvanta)');
		return $s;
	}

	private static function list_of($csv) {
		return array_values(array_filter(array_map('trim', explode(',', strtolower((string) $csv)))));
	}

	// ---------- the guard ----------

	/** Is this save someone trying to put a post live? */
	private static function is_go_live($data, $postarr) {
		if (self::$bypass || (defined('DOING_AUTOSAVE') && DOING_AUTOSAVE)) {
			return false;
		}
		$o = self::opts();
		if (!in_array($data['post_type'], self::list_of($o['post_types']), true)) {
			return false;
		}
		if (!in_array($data['post_status'], array('publish', 'future'), true)) {
			return false;
		}
		$id = isset($postarr['ID']) ? (int) $postarr['ID'] : 0;
		$before = $id ? get_post_status($id) : false;
		if ($before === 'publish') {
			return false; // already live: edits of live posts are not covered by this version
		}
		if ($before === 'future') {
			// Scheduled and already checked: meta, slug or date changes keep the approval;
			// a new title or text needs a new one.
			$checked = get_post_meta($id, self::META_HASH, true);
			if ($checked === '' || $checked === self::fingerprint(wp_unslash($data['post_title']), wp_unslash($data['post_content']))) {
				return false;
			}
		}
		$users = self::list_of($o['users']);
		if ($users) {
			$u = wp_get_current_user();
			return $u && $u->exists() && in_array(strtolower($u->user_login), $users, true);
		}
		return true; // no user list: every publish is checked
	}

	/** Runs on every save. A post going live is checked with Orvanta first; anything but "allow" keeps it Pending. */
	public static function guard($data, $postarr) {
		self::$last = null;
		if (!self::is_go_live($data, $postarr)) {
			return $data;
		}
		$target = $data['post_status'];
		$title = wp_unslash($data['post_title']);
		$slug = $data['post_name'] !== '' ? $data['post_name'] : sanitize_title($title);
		$text = trim(preg_replace('/\s+/u', ' ', wp_strip_all_tags(wp_unslash($data['post_content']))));
		if (function_exists('mb_strlen') && mb_strlen($text) > 19000) {
			$text = mb_substr($text, 0, 19000) . ' … (truncated)';
		}
		$author = get_userdata((int) $data['post_author']);
		$res = self::api('POST', '/api/v1/check', array(
			'action' => 'wordpress.publish',
			'target' => substr($slug, 0, 500),
			'summary' => substr('Publish “' . ($title !== '' ? $title : '(no title)') . '”', 0, 300),
			'context' => substr(sprintf(
				"Site: %s\nType: %s\nAuthor: %s\n%s",
				home_url(),
				$data['post_type'],
				$author ? $author->user_login : '?',
				$target === 'future' ? 'Scheduled for ' . $data['post_date'] : 'Publish now'
			), 0, 3000),
			'output' => $text !== '' ? $text : '(empty)',
			'payload' => array('slug' => $slug, 'title' => $title, 'post_type' => $data['post_type'], 'status' => $target),
		));

		$hash = self::fingerprint($title, wp_unslash($data['post_content']));
		if ($res['ok'] && isset($res['body']['decision']) && $res['body']['decision'] === 'allow') {
			self::$last = array('state' => 'published', 'reason' => '', 'approval' => 0, 'target' => $target, 'hash' => $hash);
			return $data;
		}
		if ($res['ok'] && isset($res['body']['decision']) && $res['body']['decision'] === 'needs_approval') {
			self::$last = array('state' => 'waiting', 'reason' => (string) ($res['body']['reason'] ?? ''), 'approval' => (int) $res['body']['approval_id'], 'target' => $target, 'hash' => $hash);
		} elseif ($res['ok'] && isset($res['body']['decision']) && $res['body']['decision'] === 'deny') {
			self::$last = array('state' => 'refused', 'reason' => (string) ($res['body']['reason'] ?? ''), 'approval' => 0, 'target' => $target, 'hash' => $hash);
		} else {
			// Fail closed: no clear answer from Orvanta, nothing goes live.
			self::$last = array('state' => 'error', 'reason' => 'Orvanta could not be reached: ' . $res['error'], 'approval' => 0, 'target' => $target, 'hash' => $hash);
		}
		$data['post_status'] = 'pending';
		return $data;
	}

	/** Saves the outcome of the check on the post, now that it has an ID. */
	public static function remember($post_id) {
		if (self::$last === null || wp_is_post_revision($post_id)) {
			return;
		}
		$l = self::$last;
		self::$last = null;
		update_post_meta($post_id, self::META_STATE, $l['state']);
		update_post_meta($post_id, self::META_REASON, $l['reason']);
		update_post_meta($post_id, self::META_TARGET, $l['target']);
		update_post_meta($post_id, self::META_CHECKED, time());
		update_post_meta($post_id, self::META_HASH, $l['hash']);
		if ($l['approval']) {
			update_post_meta($post_id, self::META_APPROVAL, $l['approval']);
			// Ask Orvanta to call us back as soon as someone decides (the 5-minute check is the fallback).
			$cb = add_query_arg('secret', rawurlencode(self::opts()['secret']), rest_url('orvanta/v1/decision'));
			self::api('POST', '/api/v1/approvals/' . $l['approval'] . '/callback', array('callback_url' => $cb));
		} else {
			delete_post_meta($post_id, self::META_APPROVAL);
		}
		if ($l['state'] === 'published') {
			self::report($post_id, true, 'Published (allowed by Orvanta rules)');
		}
	}

	/** Looks up the decision for a waiting post and acts on it. Never trusts what a callback says: always asks Orvanta. */
	public static function process($post_id) {
		$approval = (int) get_post_meta($post_id, self::META_APPROVAL, true);
		if (!$approval || get_post_meta($post_id, self::META_STATE, true) !== 'waiting') {
			return 'not_waiting';
		}
		$res = self::api('GET', '/api/v1/approvals/' . $approval);
		if (!$res['ok']) {
			return 'unreachable';
		}
		$status = $res['body']['status'] ?? 'pending';
		if ($status === 'pending') {
			return 'pending';
		}
		$by = (string) ($res['body']['decided_by'] ?? '');
		if ($status !== 'approved') {
			update_post_meta($post_id, self::META_STATE, 'declined');
			update_post_meta($post_id, self::META_REASON, 'Declined in Orvanta' . ($by ? ' by ' . $by : '') . '.');
			delete_post_meta($post_id, self::META_APPROVAL);
			self::report($post_id, false, 'Not published: declined in Orvanta');
			return 'declined';
		}
		if (!empty($res['body']['edited'])) {
			// The approver changed the text: we never publish a version they didn't approve.
			update_post_meta($post_id, self::META_STATE, 'changes_requested');
			update_post_meta($post_id, self::META_REASON, 'Approved with changes' . ($by ? ' by ' . $by : '') . '. Apply the changes, then publish again (it will be checked again).');
			delete_post_meta($post_id, self::META_APPROVAL);
			return 'changes_requested';
		}
		$post = get_post($post_id);
		if (!$post || self::fingerprint($post->post_title, $post->post_content) !== get_post_meta($post_id, self::META_HASH, true)) {
			// Changed after the request was sent: the approval was for another version.
			update_post_meta($post_id, self::META_STATE, 'changed');
			update_post_meta($post_id, self::META_REASON, 'Approved, but the post was edited after it was sent for approval, so it was not published. Publish again to send the new version.');
			delete_post_meta($post_id, self::META_APPROVAL);
			self::report($post_id, false, 'Not published: edited after approval was requested');
			return 'changed';
		}
		$target = get_post_meta($post_id, self::META_TARGET, true) === 'future' ? 'future' : 'publish';
		if ($target === 'future' && $post && strtotime($post->post_date_gmt . ' UTC') <= time()) {
			$target = 'publish'; // approved after the scheduled time: publish now
		}
		// The approval is used once: cleared before publishing so it can't be replayed.
		delete_post_meta($post_id, self::META_APPROVAL);
		update_post_meta($post_id, self::META_STATE, 'published');
		update_post_meta($post_id, self::META_REASON, 'Approved in Orvanta' . ($by ? ' by ' . $by : '') . '.');
		self::$bypass = true;
		$args = array('ID' => $post_id, 'post_status' => $target);
		if ($target === 'publish' && $post && $post->post_date_gmt !== '0000-00-00 00:00:00' && strtotime($post->post_date_gmt . ' UTC') > time()) {
			$args['post_date'] = current_time('mysql');
			$args['post_date_gmt'] = current_time('mysql', true);
		}
		$r = wp_update_post($args, true);
		self::$bypass = false;
		if (is_wp_error($r)) {
			update_post_meta($post_id, self::META_STATE, 'error');
			update_post_meta($post_id, self::META_REASON, 'Approved, but WordPress refused to publish: ' . $r->get_error_message());
			return 'error';
		}
		self::report($post_id, true, 'Published after approval');
		return 'published';
	}

	/** What the approver saw: the title and the text, ignoring whitespace differences WordPress may add on save. */
	private static function fingerprint($title, $content) {
		return hash('sha256', trim((string) $title) . "\n" . preg_replace('/\s+/u', ' ', trim((string) $content)));
	}

	/** Every 5 minutes: catches decisions whose callback didn't arrive. */
	public static function poll() {
		$q = new WP_Query(array(
			'post_type' => 'any',
			'post_status' => 'pending',
			'posts_per_page' => 25,
			'fields' => 'ids',
			'no_found_rows' => true,
			'meta_query' => array(array('key' => self::META_STATE, 'value' => 'waiting')),
		));
		foreach ($q->posts as $id) {
			self::process((int) $id);
		}
	}

	/** Tells Orvanta what happened, so it shows in the agent's activity. */
	private static function report($post_id, $ok, $what) {
		$p = get_post($post_id);
		self::api('POST', '/api/v1/events', array(
			'kind' => 'action',
			'action' => 'wordpress.publish',
			'target' => $p ? substr($p->post_name !== '' ? $p->post_name : (string) $post_id, 0, 500) : (string) $post_id,
			'success' => (bool) $ok,
			'meta' => array('post_id' => (int) $post_id, 'url' => get_permalink($post_id), 'result' => $what),
		));
	}

	// ---------- REST ----------

	public static function routes() {
		register_rest_route('orvanta/v1', '/decision', array(
			'methods' => 'POST',
			'permission_callback' => function ($req) {
				$s = self::opts()['secret'];
				return $s !== '' && hash_equals($s, (string) $req->get_param('secret'));
			},
			'callback' => function ($req) {
				$id = (int) ($req->get_json_params()['approval_id'] ?? 0);
				if (!$id) {
					return new WP_REST_Response(array('ok' => false), 400);
				}
				$posts = get_posts(array('post_type' => 'any', 'post_status' => 'any', 'numberposts' => 1, 'fields' => 'ids', 'meta_key' => self::META_APPROVAL, 'meta_value' => $id));
				if (!$posts) {
					return new WP_REST_Response(array('ok' => false), 404);
				}
				return new WP_REST_Response(array('ok' => true, 'result' => self::process((int) $posts[0])), 200);
			},
		));
		// The agent sees in the API response why its post is not live yet.
		foreach (self::list_of(self::opts()['post_types']) as $type) {
			register_rest_field($type, 'orvanta', array(
				'get_callback' => function ($p) {
					$state = get_post_meta($p['id'], self::META_STATE, true);
					if (!$state) {
						return null;
					}
					return array(
						'state' => $state,
						'reason' => get_post_meta($p['id'], self::META_REASON, true),
						'approval_id' => ((int) get_post_meta($p['id'], self::META_APPROVAL, true)) ?: null,
					);
				},
				'schema' => array('type' => array('object', 'null'), 'context' => array('view', 'edit'), 'readonly' => true),
			));
		}
	}

	// ---------- HTTP ----------

	private static function api($method, $path, $body = null) {
		$o = self::opts();
		if ($o['api_key'] === '') {
			return array('ok' => false, 'body' => null, 'error' => 'no Orvanta key in Settings → Orvanta');
		}
		$args = array(
			'method' => $method,
			'timeout' => 10,
			'headers' => array('Authorization' => 'Bearer ' . $o['api_key'], 'Content-Type' => 'application/json'),
		);
		if ($body !== null) {
			$args['body'] = wp_json_encode($body);
		}
		$r = wp_remote_request(untrailingslashit($o['api_url']) . $path, $args);
		if (is_wp_error($r)) {
			return array('ok' => false, 'body' => null, 'error' => $r->get_error_message());
		}
		$code = (int) wp_remote_retrieve_response_code($r);
		$json = json_decode(wp_remote_retrieve_body($r), true);
		if ($code < 200 || $code >= 300) {
			$msg = is_array($json) && isset($json['message']) ? $json['message'] : 'HTTP ' . $code;
			return array('ok' => false, 'body' => $json, 'error' => $msg);
		}
		return array('ok' => true, 'body' => is_array($json) ? $json : array(), 'error' => '');
	}

	// ---------- updates ----------

	/** The latest release, as described by orvantahq.io (cached for 6 hours). */
	private static function latest() {
		$cached = get_site_transient('orvanta_publish_guard_latest');
		if (is_array($cached)) {
			return $cached;
		}
		$r = wp_remote_get(apply_filters('orvanta_publish_guard_update_url', self::UPDATE_URL), array('timeout' => 10));
		$info = is_wp_error($r) || (int) wp_remote_retrieve_response_code($r) !== 200 ? null : json_decode(wp_remote_retrieve_body($r), true);
		$info = is_array($info) && !empty($info['version']) && !empty($info['download_url']) ? $info : array();
		set_site_transient('orvanta_publish_guard_latest', $info, $info ? 6 * HOUR_IN_SECONDS : HOUR_IN_SECONDS);
		return $info;
	}

	/** New versions show up in Dashboard → Updates and Plugins, like any other plugin. */
	public static function check_update($transient) {
		if (!is_object($transient)) {
			return $transient;
		}
		$info = self::latest();
		$file = plugin_basename(__FILE__);
		$item = (object) array(
			'slug' => 'orvanta-publish-guard',
			'plugin' => $file,
			'new_version' => $info['version'] ?? self::VERSION,
			'url' => 'https://orvantahq.io',
			'package' => $info['download_url'] ?? '',
			'tested' => $info['tested'] ?? '',
			'requires_php' => '7.4',
		);
		if ($info && version_compare($info['version'], self::VERSION, '>')) {
			$transient->response[$file] = $item;
		} else {
			$transient->no_update[$file] = $item;
		}
		return $transient;
	}

	/** The "View details" window of the update. */
	public static function update_details($result, $action, $args) {
		if ($action !== 'plugin_information' || ($args->slug ?? '') !== 'orvanta-publish-guard') {
			return $result;
		}
		$info = self::latest();
		return (object) array(
			'name' => 'Orvanta Publish Guard',
			'slug' => 'orvanta-publish-guard',
			'version' => $info['version'] ?? self::VERSION,
			'author' => '<a href="https://orvantahq.io">Orvanta</a>',
			'homepage' => 'https://orvantahq.io',
			'download_link' => $info['download_url'] ?? '',
			'requires_php' => '7.4',
			'sections' => array('changelog' => wp_kses_post($info['changelog'] ?? 'See orvantahq.io.')),
		);
	}

	// ---------- admin ----------

	public static function menu() {
		add_options_page('Orvanta', 'Orvanta', 'manage_options', 'orvanta', array(__CLASS__, 'page'));
	}

	public static function register_settings() {
		register_setting('orvanta', self::OPT, array('sanitize_callback' => function ($in) {
			$o = self::opts();
			$in = is_array($in) ? $in : array();
			$o['api_url'] = esc_url_raw(trim($in['api_url'] ?? $o['api_url']));
			if (isset($in['api_key']) && trim($in['api_key']) !== '') {
				$o['api_key'] = sanitize_text_field(trim($in['api_key'])); // left blank = keep the saved key
			}
			$o['users'] = sanitize_text_field($in['users'] ?? '');
			$o['post_types'] = sanitize_text_field(($in['post_types'] ?? '') !== '' ? $in['post_types'] : 'post');
			return $o;
		}));
	}

	public static function page() {
		if (!current_user_can('manage_options')) {
			return;
		}
		$o = self::opts();
		$held = get_posts(array('post_type' => 'any', 'post_status' => 'any', 'numberposts' => 20, 'meta_key' => self::META_STATE, 'meta_compare' => 'EXISTS', 'orderby' => 'modified'));
		?>
		<div class="wrap">
			<h1>Orvanta Publish Guard</h1>
			<p>Every time a post is about to go live, WordPress asks Orvanta first. If Orvanta says it needs a human decision, the post waits as <strong>Pending</strong> and goes live once approved. If Orvanta can't be reached, nothing is published.</p>
			<?php if (isset($_GET['orvanta_test'])) : ?>
				<div class="notice notice-<?php echo $_GET['orvanta_test'] === 'ok' ? 'success' : 'error'; ?>"><p><?php echo esc_html(wp_unslash($_GET['orvanta_msg'] ?? '')); ?></p></div>
			<?php endif; ?>
			<form method="post" action="options.php">
				<?php settings_fields('orvanta'); ?>
				<table class="form-table">
					<tr><th><label for="ov-url">Orvanta address</label></th>
						<td><input id="ov-url" class="regular-text" name="<?php echo self::OPT; ?>[api_url]" value="<?php echo esc_attr($o['api_url']); ?>" /></td></tr>
					<tr><th><label for="ov-key">Agent key</label></th>
						<td><input id="ov-key" class="regular-text" type="password" autocomplete="off" name="<?php echo self::OPT; ?>[api_key]" placeholder="<?php echo $o['api_key'] ? 'Saved (leave blank to keep it)' : 'Paste the key of your publisher agent'; ?>" />
						<p class="description">The key of the agent in Orvanta (Agents → your agent → API key). Your WordPress passwords never leave this site.</p></td></tr>
					<tr><th><label for="ov-users">Users to guard</label></th>
						<td><input id="ov-users" class="regular-text" name="<?php echo self::OPT; ?>[users]" value="<?php echo esc_attr($o['users']); ?>" placeholder="e.g. publisher-agent" />
						<p class="description">WordPress usernames, comma-separated, whose publishes go through Orvanta (your agent's user). Leave empty to check every publish, including yours.</p></td></tr>
					<tr><th><label for="ov-types">Post types</label></th>
						<td><input id="ov-types" class="regular-text" name="<?php echo self::OPT; ?>[post_types]" value="<?php echo esc_attr($o['post_types']); ?>" />
						<p class="description">Comma-separated, e.g. <code>post, page</code>.</p></td></tr>
				</table>
				<?php submit_button(); ?>
			</form>
			<form method="post" action="<?php echo esc_url(admin_url('admin-post.php')); ?>">
				<input type="hidden" name="action" value="orvanta_test" /><?php wp_nonce_field('orvanta_test'); ?>
				<?php submit_button('Test the connection', 'secondary', 'submit', false); ?>
			</form>
			<h2>Recent checks</h2>
			<?php if (!$held) : ?>
				<p>Nothing yet.</p>
			<?php else : ?>
				<table class="widefat striped"><thead><tr><th>Post</th><th>Status</th><th>Orvanta</th><th>Details</th></tr></thead><tbody>
				<?php foreach ($held as $p) : ?>
					<tr><td><a href="<?php echo esc_url(get_edit_post_link($p->ID)); ?>"><?php echo esc_html(get_the_title($p) ?: '(no title)'); ?></a></td>
						<td><?php echo esc_html($p->post_status); ?></td>
						<td><?php echo esc_html(self::label(get_post_meta($p->ID, self::META_STATE, true))); ?></td>
						<td><?php echo esc_html(get_post_meta($p->ID, self::META_REASON, true)); ?></td></tr>
				<?php endforeach; ?>
				</tbody></table>
				<form method="post" action="<?php echo esc_url(admin_url('admin-post.php')); ?>">
					<input type="hidden" name="action" value="orvanta_recheck" /><?php wp_nonce_field('orvanta_recheck'); ?>
					<?php submit_button('Check waiting posts now', 'secondary', 'submit', false); ?>
				</form>
			<?php endif; ?>
		</div>
		<?php
	}

	private static function label($state) {
		$labels = array(
			'waiting' => 'Waiting for approval',
			'published' => 'Published',
			'declined' => 'Declined',
			'refused' => 'Refused by a rule',
			'changes_requested' => 'Approved with changes',
			'changed' => 'Edited after the request: not published',
			'error' => 'Not published (Orvanta unreachable)',
		);
		return $labels[$state] ?? $state;
	}

	public static function test_connection() {
		check_admin_referer('orvanta_test');
		if (!current_user_can('manage_options')) {
			wp_die('Forbidden');
		}
		$r = self::api('GET', '/api/v1/config');
		$ok = $r['ok'] && !empty($r['body']['agent_id']);
		$msg = $ok ? 'Connected to Orvanta as agent “' . $r['body']['name'] . '”.' : 'Could not connect: ' . ($r['error'] ?: 'this key is not an agent key');
		wp_safe_redirect(add_query_arg(array('page' => 'orvanta', 'orvanta_test' => $ok ? 'ok' : 'fail', 'orvanta_msg' => rawurlencode($msg)), admin_url('options-general.php')));
		exit;
	}

	public static function recheck_now() {
		check_admin_referer('orvanta_recheck');
		if (!current_user_can('manage_options')) {
			wp_die('Forbidden');
		}
		self::poll();
		wp_safe_redirect(admin_url('options-general.php?page=orvanta'));
		exit;
	}

	/** On the post's edit screen: why it isn't live. */
	public static function notice() {
		$screen = function_exists('get_current_screen') ? get_current_screen() : null;
		if (!$screen || $screen->base !== 'post' || empty($_GET['post'])) {
			return;
		}
		$id = (int) $_GET['post'];
		$state = get_post_meta($id, self::META_STATE, true);
		if (!$state || $state === 'published') {
			return;
		}
		printf('<div class="notice notice-warning"><p><strong>Orvanta: %s.</strong> %s</p></div>', esc_html(self::label($state)), esc_html(get_post_meta($id, self::META_REASON, true)));
	}
}

Orvanta_Publish_Guard::init();
