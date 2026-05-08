/**
 * AddMemberInput
 * Data required for adding a member to a tenant
 */
export interface AddMemberInput {
  userId: string;
  email?: string;
  role: string;
  invitedBy: string;
}
