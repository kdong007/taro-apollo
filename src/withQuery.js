import _ from "lodash";
import { getApolloClient } from "./apolloClient";

function optionsEqual(op1, op2) {
    if (_.isEmpty(op1) && _.isEmpty(op2)) {
        return true;
    }
    if (_.isEmpty(op1) || _.isEmpty(op2)) {
        return false;
    }

    return op1.query === op2.query && _.isEqual(op1.variables, op2.variables);
}

function cleanTypename(obj) {
    if (_.isArray(obj)) {
        return obj.map(cleanTypename);
    } else if (_.isObject(obj)) {
        return _(obj)
            .omitBy((val, key) => key === "__typename")
            .mapValues(cleanTypename)
            .value();
    } else {
        return obj;
    }
}


export default function withQuery(config = {}) {
    const {
        query: configQuery,
        variables: configVariables,
    } = config;

    const evalQuery = (props, state) => {
        const query = _.isFunction(configQuery) ? configQuery(props, state) : configQuery;
        if (!query) {
            throw new Error("null query!!");
        }
        return query;
    };

    const evalVariables = (props, state) => {
        return _.isFunction(configVariables) ? configVariables(props, state) : configVariables;
    };

    const shouldSkip = (props, state) => {
        const query = evalQuery(props, state);
        if (!query) {
            return true;
        }

        const queryNeedsVariable = !!_.get(query, "definitions.0.variableDefinitions.0");
        return queryNeedsVariable && !evalVariables(props, state);
    };

    return Component => class extends Component {

        constructor() {
            super(...arguments);
            this._queryWatcher = null;
            this._querySubscription = null;
            this._updateResult = _.debounce(this._updateResult, 0);
        }

        componentDidMount() {
            if (super.componentDidMount) {
                super.componentDidMount(...arguments);
            }
            this._watchOrUpdateQuery(this.props, this.state);
        }

        componentDidUpdate() {
            if (super.componentDidUpdate) {
                super.componentDidUpdate(...arguments);
            }
            this._watchOrUpdateQuery(this.props, this.state);
        }

        componentWillUnmount() {
            if (super.componentWillUnmount) {
                super.componentWillUnmount(...arguments);
            }

            if (this._querySubscription) {
                this._querySubscription.unsubscribe();
            }

            delete this._querySubscription;
            delete this._queryWatcher;
        }

        _watchOrUpdateQuery = (props, state) => {
            if (shouldSkip(props, state)) {
                return;
            }

            const options = {
                query: evalQuery(props, state),
                variables: evalVariables(props, state),
            };

            if (optionsEqual(options, this.prevOptions)) {
                return;
            }
            this.prevOptions = { ...options };
            if (this._queryWatcher) {
                this._queryWatcher.setOptions(options);
            } else {
                this._queryWatcher = getApolloClient().watchQuery(options);
                this._querySubscription = this._queryWatcher.subscribe({
                    next: this._updateResult,
                    error: this._updateResult,
                });
            }
            this._updateResult();
        }

        _updateResult = () => {
            if (!this._queryWatcher) {
                return;
            }

            this.prevProps = _.assign({}, this.props);


            const { data, ...otherResult } = this._queryWatcher.currentResult();

            const updateProps = {
                data: cleanTypename(data),
                ...otherResult,
                fetchMore: this._fetchMore,
                refetch: this._refetch,
            };
            _.assign(this.props, updateProps);

            this._unsafeCallUpdate = true;
            this.setState({}, () => delete this._unsafeCallUpdate);
        }

        _fetchMore = options => this._queryWatcher.fetchMore(options)

        _refetch = () => {
            if (!this._queryWatcher) {
                return Promise.resolve(null);
            }
            this._queryWatcher.resetLastResults();
            const promise = this._queryWatcher.refetch()
                .then(this._updateResult)
                .catch(this._updateResult);
            this._updateResult();
            return promise;
        };

    };
}