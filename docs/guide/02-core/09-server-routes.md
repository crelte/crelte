# Server routes

Server routes are http request handler which can be anything from an api endpoint to
hardcoded redirects. They can be registered in the `src/server.js` file via the `routes`
function.

```js
/** @param {import('crelte/server').ServerRouter} router */
export function routes(router) {
	// redirect from /redirect to /redirected
	router.get('/redirect', csr => Response.redirect(csr.frontendUrl('/redirected')));
	
	// check if the number in the url matches the number in the body
	router.post('/api/:number/matches', csr => {
		const data = await csr.req.json();
		if (typeof data.number !== 'number') {
			throw new Response('expected number', { status: 400 });
		}
		
		const number = parseInt(csr.req.getParam('number'));
		if (isNaN(number)) {
			throw new Response('expected number param', { status: 400 });
		}
		
		return Response.json({ matches: data.number === number });
	});
}
```

## Handler

A [Handler](/types/server/type-aliases/Handler.html) is a function which takes a
[CrelteServerRequest](/types/server/classes/CrelteServerRequest.html) and returns a
WebApi [Response](https://developer.mozilla.org/docs/Web/API/Response).
`csr.req` is a [ServerRequest](/types/server/classes/ServerRequest.html) which is
basically a WebApi `Request` with some added properties. The idear behind `CreateServerRequest`
is to be really similar to the main `Crelte` type allowing to use known methods like `query`.
