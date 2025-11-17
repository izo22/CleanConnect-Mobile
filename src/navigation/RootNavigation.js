// src/navigation/RootNavigation.js
import { createRef } from 'react';
import { CommonActions } from '@react-navigation/native';

export const navigationRef = createRef();

export function navigate(name, params) {
  if (navigationRef.current) {
    navigationRef.current.navigate(name, params);
  }
}

export function reset(state) {
  if (navigationRef.current) {
    navigationRef.current.dispatch(
      CommonActions.reset(state)
    );
  }
}
