# Data Flow

To understand the event system and generally what happens when, it
is useful to know the data flow in Crelte.

```
┌─────────────────────────────────────────────┐             
│ Incoming Request                            │             
│ build request from: url + state + headers   │             
└──────────────────────┬──────────────────────┘             
                       │                                    
                       ▼                                    
┌─────────────────────────────────────────────┐             
│ Determine Site                              │             
│ (or use default)                            │             
└──────────────────────┬──────────────────────┘             
                       │                                    
                       ▼                                    
┌─────────────────────────────────────────────┐             
│ beforeRequest (event)                       │             
└──────────────────────┬──────────────────────┘             
                       │                                    
                       ▼                                    
┌─────────────────────────────────────────────┐             
│ Site mismatch?                              │             
│ → redirect to acceptLang-matching site      │             
└──────────────────────┬──────────────────────┘             
                       │                                    
                       ▼                                    
┌─────────────────────────────────────────────┐             
│ onRequest (call)                            │             
└──────────────────────┬──────────────────────┘             
                       │                                    
                       ▼                                    
             ┌─────────── PARALLEL ───────────┐             
             │                                │             
             ▼                                ▼             
┌─────────────────────────┐      ┌─────────────────────────┐
│ app.loadGlobalData [^1] │      │ loadEntry (event)       │
│ loadGlobalData (event)  │      │ app.loadEntry [^2]      │
│ plugin.loadGlobalData   │      └────────────┬────────────┘
└───────────┬─────────────┘                   │             
            │                                 ▼             
            │                    ┌─────────────────────────┐
            │                    │ afterLoadEntry (event)  │
            │                    └────────────┬────────────┘
            │                                 │             
            │                                 ▼             
            │                    ┌─────────────────────────┐
            │                    │ loadTemplates           │
            │                    │ (from app.templates)    │
            │                    └────────────┬────────────┘
            └──────────┬──────────────────────┘             
                       │                                    
                       ▼                                    
┌─────────────────────────────────────────────┐             
│ template.loadData (if defined)              │             
│ app.loadEntryData (if defined)              │             
│ loadData (event)                            │             
│ plugin.loadData                             │             
└──────────────────────┬──────────────────────┘             
                       │                                    
                       ▼                                    
┌─────────────────────────────────────────────┐             
│ Convert to Route                            │             
└──────────────────────┬──────────────────────┘             
                       │                                    
                       ▼                                    
┌─────────────────────────────────────────────┐             
│ Render                                      │             
│ - route notify                              │             
│ - site notify                               │             
│ - entry notify                              │             
│ - onRoute                                   │             
│ - globalsUpdate                             │             
│ - beforeRender (event)                      │             
│ - plugin.render                             │             
│ - update the dom                            │             
│ - afterRender (event)                       │             
└─────────────────────────────────────────────┘             
```

[^1]: If `app.loadGlobalData` is **not defined**, Crelte automatically loads `global.graphql`.  
The returned data is then set as globals.

[^2]: If `app.loadEntry` is **empty or not defined**, Crelte automatically loads
`entry.graphql` using the `queryEntry` helper. Passing a GraphQL query to
`app.loadEntry` also results in an automatic call to `queryEntry`.
This will not happen if the loadEntry event returned an entry.
