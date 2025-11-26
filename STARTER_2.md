
Steps:

mkdir test-crelte-2
cd test-crelte-2

ddev config --project-type=craftcms --docroot=craft/web

rm -r craft/web

ddev exec composer create-project craftcms/craft craft --no-interaction --no-scripts

cp craft/.env.example.dev craft/.env

rm craft/composer.json
mv craft/composer.json.default craft/composer.json

ddev config --composer-root=craft

nano .ddev/commands/web/npm
```
#!/bin/bash
## Description: Run npm inside the svelte folder
## Usage: npm [flags] [args]
## Example: "ddev npm install" or "ddev npm update"

cd /var/www/html/svelte/; npm "$@"
```

// add
web_environment:
  - CRAFT_CMD_ROOT=/var/www/html/backend

ddev craft install
