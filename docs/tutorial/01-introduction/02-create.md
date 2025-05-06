# Creating a project

## Prerequisites
- You know how to use the terminal [Guide](https://craftcms.com/docs/getting-started-tutorial/environment/terminal.html)
- You have ddev installed [Guide](https://ddev.readthedocs.io/en/stable)
- You have node and npm installed, we recommend using a version manager like [nvm](https://github.com/nvm-sh/nvm) or [fnm](https://github.com/Schniz/fnm)

If the following commands each return a version number you are good to go:

```bash
ddev -v
node -v
npm -v
```

## Create a new project
1. The simplest way to create a new Crelte project is to run `npx crelte-cli create`.
2. The first question will be where you should the project be created. We will call it `tutorial`.
3. Then enter an email, username and password (you will need this to login into Craft).
4. For the site name we will use `Tutorial`.
5. As language choose en-US.
6. crelte-cli will now initialize the project this might take a minute.
7. After the project is created, you can start the frotend.
8. `cd tutorial/svelte && npm run dev`

At this point you should be able to access the project at `http://localhost:8080`.
