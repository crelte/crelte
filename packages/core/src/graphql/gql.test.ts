import { test, expect, describe } from 'vitest';
import { gql } from './GraphQl.js';

// tests for the gql function
// testing the query property
describe('gql: query property', () => {
	test('gql: without variables', () => {
		const query = gql`a bc`;

		expect(query).toHaveProperty('query', 'a bc');
		expect(query).toHaveProperty('path');
	});

	test('gql: with one variable', () => {
		const variable = 'var';
		const query = gql`a ${variable} bc`;

		expect(query).toHaveProperty('query', `a ${variable} bc`);
		expect(query).toHaveProperty('path');
	});

	test('gql: with multiple variables', () => {
		const variable1 = 'var1';
		const variable2 = 'var2';
		const variable3 = 'var3';

		const query = gql`a ${variable1} bc ${variable2} def ${variable3}`;

		expect(query).toHaveProperty(
			'query',
			`a ${variable1} bc ${variable2} def ${variable3}`,
		);
		expect(query).toHaveProperty('path');
	});

	test('gql: beginning with variable', () => {
		const variable1 = 'var1';
		const variable2 = 'var2';
		const variable3 = 'var3';

		const query = gql`${variable1} abc ${variable2} def ${variable3}`;

		expect(query).toHaveProperty(
			'query',
			`${variable1} abc ${variable2} def ${variable3}`,
		);
		expect(query).toHaveProperty('path');
	});

	test('gql: ending with variable', () => {
		const variable1 = 'var1';

		const query = gql`abcdef ${variable1}`;

		expect(query.query.trim()).toBe(`abcdef ${variable1}`);
		expect(query).toHaveProperty('path');
	});

	test('gql: exclusive variable', () => {
		const variable1 = 'var1';

		const query = gql`
			${variable1}
		`;

		expect(query.query.trim()).toBe(`${variable1}`);
		expect(query).toHaveProperty('path');
	});

	test('gql: empty string', () => {
		const query = gql``;

		expect(query).toHaveProperty('query', ``);
		expect(query).toHaveProperty('path');
	});

	test('gql: only variables', () => {
		const variable1 = 'var1';
		const variable2 = 'var2';
		const variable3 = 'var3';

		// prettier-ignore
		const query = gql`${variable1}${variable2}${variable3}`;

		expect(query).toHaveProperty(
			'query',
			`${variable1}${variable2}${variable3}`,
		);
		expect(query).toHaveProperty('path');
	});
});

describe('gql: path property', () => {
	const root = process.cwd();

	test('gql: path is graphql.js file', () => {
		const query = gql``;

		expect(query).toHaveProperty('query');
		expect(query).toHaveProperty(
			'path',
			'file://' + root + '/src/graphql/GraphQl.ts',
		);
	});
});

describe('gql: nesting', () => {
	test('gql: nesting', () => {
		const variable1 = 'var1';
		const variable2 = 'var2';
		const variable3 = 'var3';

		const query = gql`a ${variable1} bc ${gql`a ${variable2} bc ${variable3}`}`;

		expect(query).toHaveProperty(
			'query',
			`a ${variable1} bc a ${variable2} bc ${variable3}`,
		);
		expect(query).toHaveProperty('path');
	});
});

describe.todo('gql: variable types. Handling of objects and arrays');
