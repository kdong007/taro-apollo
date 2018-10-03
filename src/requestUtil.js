import { getApolloClient } from "./apolloClient";

export async function sendQuery(query, variables, ignoreCache) {
    const params = { query, variables };
    if (ignoreCache) {
        params.fetchPolicy = "network-only";
    }
    const { data, errors } = await getApolloClient().query(params);
    if (errors) {
        throw errors;
    }
    return data;
}

export async function sendMutation(mutation, variables, refetchQueries) {
    const params = { mutation, variables, refetchQueries };
    const { data, errors } = await getApolloClient().mutate(params);
    if (errors) {
        throw errors;
    }
    return data;
}