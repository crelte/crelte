# Build and Deploy

Todo

## Sites

In production (`NODE_ENV=production`) sites are cached forever, so to clear the cache
you need to clear the craft cache and do a fresh build or delete `dist/sites.json`.

## Staging

In staging or testing environments it can be useful to put the application behind
a password. For this you can the some environment variables:

```env
BASIC_AUTH_USER=your-username
BASIC_AUTH_PASSWORD=your-password
```
