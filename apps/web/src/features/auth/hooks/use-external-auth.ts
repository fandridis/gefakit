// src/hooks/use-auth.ts

/**
 * This hook is used to store the auth state in the external store,
 * so it can be used in tanstack-router hooks like "beforeLoad".
 */

import { GetSessionResponseDTO } from "@gefakit/shared";
import { useSyncExternalStore } from "react";
import { useAuth } from "@/features/auth/hooks/use-auth";

type SubscribeListener = () => void;

let listeners = [] as Array<SubscribeListener>;
export type AuthState = {
  isInitialLoading: boolean;
  session: GetSessionResponseDTO['session'];
  user: GetSessionResponseDTO['user'];
};

export const authState = {
  isInitialLoading: true,
  session: null,
  user: null,
} as AuthState;

export const externalAuthStore = {
  setIsInitialLoading(isInitialLoading: AuthState["isInitialLoading"]) {
    authState.isInitialLoading = isInitialLoading;
    emitChange();
  },
  setSession(session: AuthState["session"]) {
    authState.session = session;
    emitChange();
  },
  setUser(user: AuthState["user"]) {
    authState.user = user;
    emitChange();
  },
  subscribe(listener: SubscribeListener) {
    listeners = [...listeners, listener];
    return () => {
      listeners = listeners.filter((l) => l !== listener);
    };
  },
  getSnapshot() {
    return authState;
  },
};

function emitChange() {
  for (const listener of listeners) {
    listener();
  }
}

export function useExternalAuthState() {
  return useSyncExternalStore(externalAuthStore.subscribe, externalAuthStore.getSnapshot);
}

export function useExternalAuth() {
  const authState = useExternalAuthState();
  const auth = useAuth();

  if (auth.session?.session) {
    externalAuthStore.setSession(auth.session.session);
    externalAuthStore.setUser(auth.session.user);
  }

  if (
    auth.isSessionError &&
    authState.session) {
    externalAuthStore.setSession(null);
    externalAuthStore.setUser(null);
  }

  if (authState.isInitialLoading) {
    externalAuthStore.setIsInitialLoading(auth.isLoadingSession);
  }

  if (auth.isSessionError || auth.isSessionSuccess) {
    externalAuthStore.setIsInitialLoading(false);
  }

  return {
    isInitialLoading: authState.isInitialLoading,
    session: authState.session,
    user: authState.user,
  };
}
