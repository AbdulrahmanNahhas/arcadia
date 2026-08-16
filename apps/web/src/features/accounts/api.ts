import type {
  AccountPolicyPreview,
  AccountRestrictionEditor,
  AdminUpdateAccountInput,
  CreateAccountInput,
  CreateInviteInput,
  FamilyAccount,
  SessionAccount,
  UpdateAccountInput,
} from "@arcadia/contracts";
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";

export const accountKeys = {
  current: ["account", "current"] as const,
  family: ["account", "family"] as const,
  admin: ["account", "admin"] as const,
};

export function getCurrentAccount() {
  return apiFetch<SessionAccount>("/api/v1/me");
}

export function getFamilyAccounts() {
  return apiFetch<FamilyAccount[]>("/api/v1/family/accounts");
}

export function updateCurrentAccount(input: UpdateAccountInput) {
  return apiFetch<FamilyAccount>("/api/v1/me", {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export function getAdminAccounts() {
  return apiFetch<AccountPolicyPreview[]>("/api/v1/admin/accounts");
}

export function createAdminAccount(input: CreateAccountInput) {
  return apiFetch<{ id: string }>("/api/v1/admin/accounts", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function createAccountInvite(input: CreateInviteInput) {
  return apiFetch<{ id: string; token: string; inviteUrl: string; expiresAt: string }>(
    "/api/v1/admin/invites",
    { method: "POST", body: JSON.stringify(input) },
  );
}

export function updateAdminAccount(accountId: string, input: AdminUpdateAccountInput) {
  return apiFetch<{ updated: true }>(`/api/v1/admin/accounts/${accountId}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export function getAccountRestrictions(accountId: string) {
  return apiFetch<AccountRestrictionEditor>(`/api/v1/admin/accounts/${accountId}/restrictions`);
}

export function useCurrentAccount() {
  return useQuery({ queryKey: accountKeys.current, queryFn: getCurrentAccount, staleTime: 60_000 });
}
