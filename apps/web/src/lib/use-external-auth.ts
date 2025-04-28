// src/hooks/use-auth.ts

import { SessionDTO, UserDTO } from "@gefakit/shared";
import { useQuery } from "@tanstack/react-query";
import { useSyncExternalStore } from "react";
import { apiGetSession } from "@/features/auth/api";
import { sessionQueryKey, useAuth } from "@/features/auth/hooks/useAuth";
import { ApiError } from "@gefakit/shared";
import { flushSync } from "react-dom";

type SubscribeListener = () => void;

let listeners = [] as Array<SubscribeListener>;
export type AuthState = {
  // isAuthenticated: boolean;
  isInitialLoading: boolean;
  session: SessionDTO | undefined;
  user: UserDTO | undefined;
};

export const authState = {
  isAuthenticated: false,
  isInitialLoading: true,
  session: undefined,
  user: undefined,
} as AuthState;

export const externalAuthStore = {
  setIsInitialLoading(isInitialLoading: AuthState["isInitialLoading"]) {
    authState.isInitialLoading = isInitialLoading;
    emitChange();
  },
//   setIsAuthenticated(isAuthenticated: AuthState["isAuthenticated"]) {
//     authState.isAuthenticated = isAuthenticated;
//     emitChange();
//   },
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

export function useExternalSession() {
  const authState = useExternalAuthState();
  const auth = useAuth();

  if (auth.session?.session) {
    // authStore.setIsAuthenticated(true);
    externalAuthStore.setSession(auth.session.session);
    externalAuthStore.setUser(auth.session.user);
  }

  if (
    auth.isSessionError &&
    authState.session) {
    externalAuthStore.setSession(undefined);
    externalAuthStore.setUser(undefined);
    // window.location.href = "/signin";
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
