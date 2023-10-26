# action-sendgrid-sync

GitHub action to sync handlebars template with sendgrid

## Basic usage (using with Github Actions)

### Example workflow

```yml
- id: sendgrid-sync
  name: SendGrid sync
  uses: nanopx/action-sendgrid-sync@0.5.2
  with:
    githubToken: ${{ secrets.GITHUB_TOKEN }}
    sendgridApiKey: ${{ secrets.SENDGRID_API_KEY }}
    templatesDir: 'templates/sendgrid/'
    partialsDir: 'templates/sendgrid/partials/'
    templatePrefix: ${{ env.STAGE }}/
    subjectTemplate: '{{subject}}'
    preserveVersions: 2
    outputFile: ./mapping.json
    forceSyncAll: false
    dryRun: false
```

### Inputs:

| Name | Requirement | Description |
|:----:|:----------- |:----------- |
| `githubToken` | _required_ | GitHub personal access token |
| `sendgridApiKey` | _required_ | SendGrid API Key |
| `templatesDir` | _required_ | Templates directory |
| `partialsDir` | _optional_ | Partials directory |
| `templatePrefix` | _optional_ | Template name prefix |
| `subjectTemplate` | _optional_ | Subject template. Defaults to `{{subject}}` |
| `subjectMap` | _optional_ | Path to json file of subject templates to use per template |
| `preserveVersions` | _optional_ | Number of versions to preserve per template. Defaults to `'2'` |
| `outputFile` | _optional_ | Output file path for the mapping json |
| `dryRun` | _optional_ | Enable dry run mode |
| `forceSyncAll` | _optional_ | Force sync all files in templates dir (Useful for initial synchronization) |

### Outputs:

- `sendgridTemplateIdMapping`: JSON string which contains a mapping of template name(key) and template id(value)

## CLI Usage

```bash
$ npx sendgrid-sync -h

  Usage
    $ sendgrid-sync <templatesDir>

  Options
    --partials-dir, -p  Path to partials directory
    --api-key, -a       SendGrid API key (Recommended to use 'SENDGRID_API_KEY' environment variable)
    --template-prefix   Template name prefixes
    --subject-template  Subject template
    --subject-map       Subject map json file
    --target, -t        Target template base names (names without the prefix specified with '--template-prefix')
    --preserve-versions Number of versions to preserve per template
    --dry-run           Dry run
    --output-file, -o   Output template mapping json to file

  Examples
    $ SENDGRID_API_KEY=<SENDGRID_API_KEY> sendgrid-sync ./path/to/templates -p ./path/to/templates/partials
    Sync all templates with SendGrid
```



### Sync all templates with SendGrid

```bash
$ npx sendgrid-sync path/to/templates/ -p path/to/partials/
```

### Create a new version with prefix for specified templates

```bash
$ npx sendgrid-sync path/to/templates/ -p path/to/partials/ --template-prefix dev/ -t target_template_name_1 -t target_template_name_2
```


