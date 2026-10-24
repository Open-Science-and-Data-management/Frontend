/**
 * The token budget the mock backend gives a new account. It belongs to the
 * server, not the UI: screens read the limit from the quota endpoint and
 * never assume this number.
 */
export const MOCK_ACCOUNT_TOKEN_LIMIT = 30000;
