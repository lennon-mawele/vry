const Invariant = require('invariant');
const Immutable = require('immutable');
const State = require('./state');
const KeyPath = require('./key-path');

const internals = {};

exports = module.exports = internals.Ref = State.create('__reference', {
	path: null
});

internals.Ref.create = function(path) {
	path = KeyPath.parse(path);

	Invariant(KeyPath.isKeyPath(path), 'Path required to create a Ref');

	return internals.Ref.factory({
		path: path
	});
}

internals.Ref.resolve = function(ref, state) {
	Invariant(internals.Ref.instanceOf(ref), 'Ref is required to resolve a ref');
	Invariant(State.isState(state), 'Root state is required to resolve a ref');

	return state.getIn(ref.get('path'));
}

internals.Ref.resolveCollection = function(refs, state) {
	Invariant(internals.Ref.collectionOf(ref), 'Collection of Ref instances is required to resolve a collection of refs');
	Invariant(State.isState(state), 'Root state is required to resolve a collection of refs');

	return refs.map(ref => internals.Ref.resolve(ref, state));
}

internals.Ref.replaceIn = function(state, subject, path) {
	Invariant(State.isState(state), 'Root state is required to replace references in subject');
	Invariant(State.isState(subject), 'Subject state is required to replace references in subject');

	path = KeyPath.parse(path);

	Invariant(KeyPath.isKeyPath(path), 'Path required to replace references in a subject');

	return subject.updateIn(path, (maybeRef) => {
		if (internals.Ref.instanceOf(maybeRef)) {
			return internals.Ref.resolve(maybeRef, state);
		} else if (internals.Ref.collectionOf(maybeRef)) {
			return internals.Ref.resolveCollection(maybeRef, state);
		} else {
			return maybeRef;
		}
	});
}