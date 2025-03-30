---
title: GraphQl
---

GraphQL serves as the link between the Craft CMS and the Crelte frontend. With the appropriate access permissions configured, you can query nearly any data within Craft.

Crelte automatically executes two queries, `global.graphql` and `entry.graphql` to optimize performance
try to make one big request with multiple queries, instead of multiple small requests.

## How does GraphQL work
Here is the basic `entry.graphql` query:

```graphql
query ($uri: [String], $siteId: [QueryArgument]) {
  entry(uri: $uri, siteId: $siteId) {
    id
    siteId
    sectionHandle
    typeHandle
    title
    cpUrl
  }
}
```

On the first line two variables are defined, `$uri` and `$siteId`. These need to be passed when
executing a graphql file.

## Note
`siteId` is available on all queries.


- how to call was already covered in loadData
- show some common queries (query, for blogs)
- show gql, and graphql files
- fragments
- transforms ?
- renames / alias
