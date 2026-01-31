export type UserSearchOut = {
  id: string;
  username: string;
  profile_photo_base64?: string | null;
};

export type FriendRequestOut = {
  incoming: UserSearchOut[];
  outgoing: UserSearchOut[];
};

export type GroupOut = {
  id: string;
  name: string;
  description: string;
  is_private: boolean;
  owner_id: string;
  admins: string[];
  members_count: number;
  members: string[];
  created_at: string;
};

export type MessageOut = {
  id: string;
  thread_id: string;
  kind: "dm" | "group";
  from_user_id: string;
  to_user_id?: string | null;
  group_id?: string | null;
  text: string;
  created_at: string;
};
