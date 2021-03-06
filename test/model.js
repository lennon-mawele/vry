const Test = require('tape')
const Immutable = require('immutable')
const _ = require('lodash')

const Model = require('../lib/model')
const Schema = require('../lib/schema')
const Ref = require('../lib/ref')

Test('Model', function(t) {
	t.plan(2 + 1)

	t.doesNotThrow(function() {
		const model = Model('test-model')

		t.ok(model instanceof Model, 'returns an instance of Model')
	}, 'accepts same arguments as `Model.create`');

	t.throws(function() {
		const state = new Model('test-model')
	}, 'does not allow being called as a constructor with `new` keyword')
})

Test('Model.create', function(t) {
	t.plan(10 + 2 + 2 + 2)

	t.doesNotThrow(function() {
		const model = Model.create({
			typeName: 'test-model'
		})

		t.ok(model instanceof Model, 'returns an object that is an instance of Model')
		t.ok(_.isFunction(model.factory), 'returns an object with a factory method')
		t.ok(_.isFunction(model.defaults), 'returns an object with a defaults method')
		t.ok(_.isFunction(model.parse), 'returns an object with a parse method')
		t.ok(_.isFunction(model.serialize), 'returns an object with a serialize method')
		t.ok(_.isFunction(model.merge), 'returns an object with a merge method')
		t.ok(_.isFunction(model.instanceOf), 'returns an object with an instanceOf method')
		t.ok(_.isFunction(model.collectionOf), 'returns an object with a collectionOf method')
		t.ok(_.isFunction(model.schema), 'returns an object with a schema method')

	}, 'accepst a plain object spec with a name for the model')

	t.doesNotThrow(function() {
		const model = Model.create('test-model')

		t.equal(model.typeName(), 'test-model', 'string as first argument is set as name of the model')
	}, 'accepts a name for the model')

	t.doesNotThrow(function() {
		const defaults = {
			a: 'some-value'
		}
		const model = Model.create({
			typeName: 'test-model',
			defaults: defaults
		})

		t.ok(Immutable.Map(defaults).equals(model.defaults()), 'some-value', 'returns an object with factory that uses specified defaults')
	}, 'accepts a plain object spec with a name and factory defaults')

	t.doesNotThrow(function() {
		const schema = { 
			foo: { 
				factory: (value) => 'bar' 
			}
		}

		const model = Model.create({
			typeName: 'test-model',
			schema: schema
		})

		t.deepEqual(model.schema(), schema, 'returns an object with schema method that returns the schema passed in')
	}, 'accepts a plain object spec with a name and schema')
})

Test('model.factory - parse', function(t) {
	t.plan(3 + 1 + 1 + 10 + 2 + 1)

	const OtherModel = Model.create({
		typeName: 'woo'
	})

	const defaultA = 'a-default';
	const defaultB = 'b-default';
	const inputA = 'a';
	const outputA = 'A';
	const outputB = 'B';
	const outputC = 'C';
	const outputD = 'D';

	const schema = {
		a: {
			factory: (value, options) => {
				t.equal(inputA, value, 'factory is called with the untransformed value');
				t.ok(_.isPlainObject(options), 'factory is called with options')
				t.equal(options.defaults, defaultA, 'default value for prop is forwarded to factory as defaults option')	

				return outputA;
			}
		},
		nested: {
			b: {
				factory: (value, options) => {
					t.equal(options.defaults, defaultB, 'nested schema factory is called with the nested default value')
					return outputB
				}
			}
		},
		nestedArray: [{
			factory: () => outputC 
		}],
		nestedModel: OtherModel,
		alreadyInstance: {
			factory() { return 'not-seen' },
			instanceOf() { return true }
		},

		iterableSchema: {
			getItemSchema: () => ({factory: (val) => val }),
			factory(val, options) {
				t.deepEqual(options.defaults, [defaultA], 'default value for iterable prop is forwarded to its factory')

				return Immutable.List(val)
			}
		},

		nestedList: Schema.listOf({
			factory: (val, options) => val
		}),

		nestedSet: Schema.setOf({
			factory: (val) => val
		}),

		nestedOrderedSet: Schema.orderedSetOf({
			factory: (val) => val
		})
	}

	const TestModel = Model.create({
		typeName: 'testModel',
		schema: schema
	})

	t.doesNotThrow(() => {
		const defaults = {
			a: defaultA,
			nested: {
				b: defaultB
			},
			nestedList: [defaultA],
			iterableSchema: [defaultA]
		}
		const attrs = {
			nonDefined: 'prop',
			a: inputA,
			nested: {
				b: 'a nested value'
			},
			nestedModel: {
				'a': 'aaa',
				'b': 'bbb'
			},
			alreadyInstance: 'already-what-it-should-be',
			nestedArray: ['values', 'array'],
			nestedList: [outputA, outputB],
			nestedSet: [outputA, outputB],
			nestedOrderedSet: [outputC, outputB, outputA]
		}

		const instance = TestModel.factory(attrs, { defaults })

		t.equal(instance.get('a'), outputA, 'value returned by factory of schema is used as value')
		t.equal(instance.get('nonDefined'), 'prop', 'parser ignores any attributes not defined in schema')
		t.equal(instance.getIn(['nested', 'b']), outputB, 'nested schema is applied to nested attributes')
		t.ok(
			Immutable.List(instance.get('nestedArray')) &&
			instance.get('nestedArray').count() === attrs.nestedArray.length &&
			instance.get('nestedArray').every(val => val === outputC)
		, 'arrays are cast as Lists and mapped with the factory of the type defintion')
		t.ok(OtherModel.instanceOf(instance.get('nestedModel')), 'Model definitions are valid type definitions')
		t.equal(instance.get('alreadyInstance'), attrs.alreadyInstance, 'mapping value with `factory` of type definition unless its `instanceOf` method returns truthy')
		
		t.ok(Immutable.List([outputA, outputB]).equals(instance.get('nestedList')), 'schema generated with `Schema.listOf` casts a value to an Immutable.List')
		t.ok(Immutable.Set([outputB, outputA]).equals(instance.get('nestedSet')), 'schema generated with `Schema.setOf` casts a value to an Immutable.Set')
		t.ok(Immutable.OrderedSet([outputC, outputB, outputA]).equals(instance.get('nestedOrderedSet')), 'schema generated with `Schema.orderedSetOf` casts a value to an Immutable.OrderedSet')

	}, 'accepts raw attributes in Seq')

	t.doesNotThrow(() => {
		const ref = Ref.create(['some', 'non-existing', 'path']) 

		const instance = TestModel.factory({
			a: ref
		})

		t.ok(ref.equals(instance.get('a')), 'when attribute value is a Ref instance it is not parsed any further')
	}, 'accepts Ref instances as attribute values')

	t.doesNotThrow(() => {
		TestModel.factory.call(null)
	}, 'can be called without context')
})

Test('model.typeName', function(t) {
	t.plan(2)

	const typeName = 'woo'
	const TestModel = Model.create(typeName)

	t.doesNotThrow(function() {
		t.equal(TestModel.typeName(), typeName, 'returns the name which was used to create it')
	}, 'allows for no arguments to be passed')
})

Test('model.defaults', function(t) {
	t.plan(2)

	const defaults = { a: 1, nested: { b: 2 }}
	const TestModel = Model.create({
		typeName: 'test',
		defaults: defaults
	})

	t.doesNotThrow(function() {
		t.ok(Immutable.Map(defaults).equals(TestModel.defaults()), 'returns the model defaults cast to a Immutable.Map')
	}, 'allows for no arguments to be passed')
})

Test('model.schema', function(t) {
	t.plan(2)

	const schema = { 
		a: { factory: _.identity }
	}
	const TestModel = Model.create({
		typeName: 'test',
		schema: schema
	})

	t.doesNotThrow(function() {
		t.deepEqual(TestModel.schema(), schema, 'returns the model schema')
	}, 'allows for no arguments to be passed')
})

Test('model.serialize', function(t) {
	t.plan(16 + 3 + 2 + 2)

	const OtherModel = Model.create({
		typeName: 'woo'
	})

	const noopFactory = (val) => val

	const inputA = 'a';
	const outputA = 'A';
	const outputB = 'B';
	const outputC = 'C';
	const omitMetaOptions = { omitMeta: false }

	const schema = {
		a: {
			// factory: noopFactory,
			serialize(value, options) {
				t.equal(inputA, value, 'serialize of type is called with the value of the ')
				t.ok(_.isPlainObject(options), 'serialize of type is called with the options passed to serialize')

				return outputA
			}
		},
		nested: {
			b: {
				// factory: noopFactory,
				serialize: () => outputB
			}
		},
		multiple: [{
			// factory: noopFactory,
			serialize: () => outputC
		}],
		nestedModel: OtherModel,
		notInstance: {
			// factory: noopFactory,
			serialize() { return 'never seen' },
			instanceOf() { return false }
		},

		nestedList: Schema.listOf({
			factory: (val) => val
		}),

		nestedSet: Schema.setOf({
			factory: (val) => val
		}),

		nestedOrderedSet: Schema.orderedSetOf({
			factory: (val) => val
		}),

		optionTest: {
			serialize(value, options) {
				t.equal(options.omitMeta, omitMetaOptions.omitMeta, 'options are forwarded to the serialize methods of nested types')

				return value
			}
		}
	}

	const TestModel = Model.create({
		typeName: 'test-model',
		schema: schema
	})


	t.doesNotThrow(() => {
		const instance = TestModel.factory({
			nonDefined: 'prop',
			a: inputA,
			nested: {
				b: 'a nested value'
			},
			nestedModel: {
				'a': 'aaa',
				'b': 'bbb'
			},
			notInstance: 'not-what-we-expect-it-to-be',

			multiple: ['values', 'array'],

			nestedList: [outputA, outputB],
			nestedSet: [outputA, outputB],
			nestedOrderedSet: [outputC, outputB, outputA]
		})
		const serialized = TestModel.serialize(instance)

		t.ok(_.isPlainObject(serialized), 'returns a plain object')
		t.equal(serialized.notDefined, instance.get('notDefined'), 'primitie values without a schema definition are not transformed')
		t.equal(serialized.a, outputA, 'value returned by serialize method of type definition is used as value')
		t.ok(_.isPlainObject(serialized.nested), 'nested attributes are transformed to a plain object')
		t.equal(serialized.nested.b, outputB, 'nested schema is applied to nested attributes')
		t.deepEqual(serialized.nestedModel, OtherModel.serialize(instance.get('nestedModel')), 'model definitions are valid schema definitions and their serialize method is used')
		t.equal(serialized.notInstance, instance.get('notInstance'), 'serialize of schema definition not applied when schema has instanceOf method that returns falsey')
		t.ok(
			_.isArray(serialized.multiple) &&
			serialized.multiple.length === instance.get('multiple').count() &&
			_.every(serialized.multiple, val => val === outputC)
		, 'Lists are transformed to arrays and mapped with the serialize function of the type defintion')
		t.ok(_.isArray(serialized.nestedList), 'nested Lists are serialized as arrays')
		t.ok(_.isArray(serialized.nestedSet), 'nested Sets are serialized as arrays')
		t.ok(_.isArray(serialized.nestedOrderedSet), 'nested OrderedSets are serialized as arrays')
		t.ok(_.isUndefined(serialized.__cid), 'the client side identifier is omitted by default')
		t.ok(_.isUndefined(serialized.__typeName), 'the model type name is omitted by default')
	}, 'accepts a model instance')

	t.doesNotThrow(() => {		
		const instance = TestModel.factory({
			optionTest: 'some-value'
		})
		const serialized = TestModel.serialize(instance, omitMetaOptions)

		t.equal(serialized.__cid, instance.get('__cid'), 'the client side identifier is included when passing `omitMeta: false` as an option')
	}, 'accepts a model instance and an object of options')

	t.doesNotThrow(() => {
		const ref = Ref.create(['some', 'non-existing', 'path']) 

		const instance = TestModel.factory({
			a: ref
		})

		const serialized = TestModel.serialize(instance)

		t.deepEqual(serialized.a, Ref.serialize(ref), 'when attribute value is a Ref instance it is serialized using `Ref.serialize`')
	}, 'accepts Ref instances as attribute values')

	t.doesNotThrow(() => {
		const instance = TestModel.factory({ someProp: inputA })

		const withContext = TestModel.serialize(instance)
		const withoutContext = TestModel.serialize.call(null, instance)

		t.deepEqual(withContext, withoutContext, 'returns the same when called out of context')
	}, 'can be called without context')
})

Test('model.merge', function(t) {
	t.plan(3 + 4 + 2 + 2)

	const rawDefaults = {
		c: 1
	}

	const TestModel = Model.create({
		typeName: 'test-state', 
		defaults: rawDefaults
	})
	const OtherModel = Model.create({
		typeName: 'other-state', 
		defaults: rawDefaults
	})

	const baseInstance = TestModel.factory({
		a: 1,
		c: 3
	})

	const rawSource = {
		a: 2,
		b: 3
	}

	const sourceInstance = TestModel.factory(rawSource)
	const otherInstance = OtherModel.factory(rawSource)

	t.doesNotThrow(function() {
		const mergedInstance = TestModel.merge(baseInstance, rawSource)

		t.ok(TestModel.instanceOf(mergedInstance), 'returns an updated instance')
		t.ok(mergedInstance.equals(baseInstance.merge(rawSource)), 'updated instance has attributes of source merged into instance')
	}, 'accepts a Model instance and a plain object of new attributes')

	t.doesNotThrow(function() {
		const mergedInstance = TestModel.merge(baseInstance, sourceInstance)

		t.ok(TestModel.instanceOf(mergedInstance), 'returns an updated instance')

		t.ok(mergedInstance.equals(baseInstance.merge(rawDefaults, rawSource)), 'updated instance has attributes of source merged into base')
		t.equals(mergedInstance.get('__cid'), baseInstance.get('__cid'), 'updated instance has client identifer `__cid` from base')
	}, 'accepts two Model instances, a base and source')

	t.doesNotThrow(function() {
		const withContext = TestModel.merge(baseInstance, sourceInstance)
		const withoutContext = TestModel.merge.call(null, baseInstance, sourceInstance)

		t.ok(withContext.equals(withoutContext), 'returns the same when called out of context')
	}, 'can be called without context')

	t.doesNotThrow(function() {
		const mergedInstance = TestModel.merge(baseInstance, otherInstance)

		t.ok(TestModel.instanceOf(mergedInstance), 'returns an updated instance of the type of the base')
	}, 'accepts a base and source instance with a different state type')
})

Test('model.mergeDeep', function(t) {
	t.plan(2 + 8)

	const OtherModel = Model.create({
		typeName: 'woo'
	})


	const existingA = 'a'
	const existingB = 'b'
	const existingC = 'c'

	const inputA = '1';
	const inputB = '2';

	const outputA = 'a1';
	const outputB = 'b2';
	const outputC = 'c3';

	const schema = {
		a: {
			mergeDeep(existing, value, options) {
				t.equal(existing, existingA, 'mergeDeep of type is called with the current value as first argument')
				t.equal(value, inputA, 'mergeDeep of type is called with the to be merged value as the second argument')

				return existing + value
			}
		},
		nested: {
			b: {
				mergeDeep: (existing, value) => existing + value
			}
		},
		multiple: [{
			mergeDeep: () => outputC
		}],
		nestedModel: OtherModel,
		notInstance: {
			mergeDeep: (existing, value) => existing + value,
			instanceOf() { return false }
		},
		notIncluded: {
			mergeDeep() {
				t.fail('not included properties should not be called')
			}
		},

		nestedList: Schema.listOf({
			factory: (val) => val
		}),

		nestedSet: Schema.setOf({
			factory: (val) => val
		}),

		nestedOrderedSet: Schema.orderedSetOf({
			factory: (val) => val
		})
	}

	const TestModel = Model.create({
		typeName: 'test-model',
		schema: schema
	})

	const existing = TestModel.factory({
		a: existingA,
		nested: {
			b: existingB
		},
		nestedModel: {
			'a': existingA,
			'b': existingB
		},
		notInstance: existingA,
		notTouched: existingA,

		multiple: ['values', 'array'],

		nestedList: [existingA, existingB],
		nestedSet: [existingA, existingB],
		nestedOrderedSet: [existingC, existingB, existingA]
	})

	t.doesNotThrow(function() {
		const merged = TestModel.mergeDeep(existing, {
			a: inputA,
			nested: {
				b: inputB
			},
			nestedModel: {
				'a': 'aaa',
				'b': 'bbb'
			},
			notInstance: inputA,
			nestedList: [outputA, outputB],
			nestedSet: [outputA, outputB],
			nestedOrderedSet: [outputC, outputB, outputA]
		})

		t.equal(merged.get('a'), outputA, 'value returned by mergeDeep of schema is used as value')
		t.equal(merged.getIn(['nested', 'b']), outputB, 'nested schema is applied to nested attributes')
		t.ok(OtherModel.instanceOf(merged.get('nestedModel')), 'Model definitions are valid type definitions for merging deep')
		t.equal(merged.get('notInstance'), inputA, 'next value is returned when definition schema has instanceOf method that returns falsey for existing value')
		
		t.ok(Immutable.List([outputA, outputB]).equals(merged.get('nestedList')), 'schema generated with `Schema.listOf` return only the new values as Lists merging is ambiguous')
		t.ok(Immutable.Set([outputA, outputB]).equals(merged.get('nestedSet')), 'schema generated with `Schema.setOf` return only then new values as Sets merging is ambiguous')
		t.ok(Immutable.OrderedSet([outputC, outputB, outputA]).equals(merged.get('nestedOrderedSet')), 'schema generated with `Schema.orderedSetOf` return only then ew value as OrderedSets merging is ambiguous')
	}, 'accepts a Model instance and a mergable data')
})

