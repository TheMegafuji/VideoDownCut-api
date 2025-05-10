# Prettier in VideoDownCut

This project uses Prettier to ensure consistent code style. Below is information on how to use Prettier in the project.

## Configuration

Prettier is configured with the following rules:

```json
{
  "singleQuote": true,
  "trailingComma": "all",
  "printWidth": 100,
  "tabWidth": 2,
  "semi": true,
  "endOfLine": "auto",
  "arrowParens": "avoid",
  "bracketSpacing": true,
  "useTabs": false,
  "quoteProps": "as-needed",
  "jsxSingleQuote": false,
  "bracketSameLine": false,
  "proseWrap": "preserve"
}
```

## ESLint Integration

Prettier is integrated with ESLint through the following packages:
- `eslint-config-prettier`: disables ESLint rules that might conflict with Prettier
- `eslint-plugin-prettier`: adds Prettier rules to ESLint

## Available Scripts

In the `package.json` file, you will find the following Prettier-related scripts:

- `npm run format`: formats only TypeScript and JavaScript files in the `src` folder
- `npm run format:check`: checks if TypeScript and JavaScript files in the `src` folder are formatted
- `npm run format:all`: formats all JS, TS, JSON, and MD files in the project
- `npm run lint`: runs ESLint (which includes Prettier rules)
- `npm run lint:fix`: runs ESLint and fixes found issues
- `npm run validate`: runs both lint and format checking

## Ignored Files

Some files and folders are ignored by Prettier formatting. The complete list can be found in the `.prettierignore` file.

## Daily Usage

To maintain code consistency:

1. Run `npm run format` before committing your changes
2. Or run `npm run validate` to check for lint or formatting issues

## Code Editor Integration

For a better experience, configure your editor to automatically format files when saving:

### VSCode
1. Install the "Prettier - Code formatter" extension
2. Enable the "Format On Save" configuration
3. Configure Prettier as the default formatter for JavaScript and TypeScript

### WebStorm/IntelliJ
1. Go to Settings > Languages & Frameworks > JavaScript > Prettier
2. Check "On 'Reformat Code' action" and "On save"

## Tips

- To ignore formatting on a specific line, use: `// prettier-ignore`
- To ignore formatting on a block, use:
  ```js
  // prettier-ignore
  const notFormattedObject = {
      a:1,
    b:2
  }
  ``` 