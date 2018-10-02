let _client = null;
export function setApolloClient(client) {
    _client = client;
}

export function getApolloClient() {
    return _client;
}