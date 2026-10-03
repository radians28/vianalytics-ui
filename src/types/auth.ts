export interface AuthToken {
  access_token: string;
  decoded_token: {
    user_id?: string;
    user_email?: string;
    user_first_name?: string;
    user_last_name?: string;
    roles?: string[];
    [key: string]: unknown;
  };
}
