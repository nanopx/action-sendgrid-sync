import * as process from 'process'
import * as cp from 'child_process'
import * as path from 'path'
import {getTemplatePartialDeps, getTemplateName, getDependencyMaps, findTemplates} from '../src/setupHandlebars'
// import {getDiffFromCommit} from '../src/getDiffFromCommit'

jest.setTimeout(1000 * 60) // 60sec

const TEMPLATES_DIR = './__tests__/fixtures/templates/'
const PARTIALS_DIR = './__tests__/fixtures/templates/partials/'
const TEST_SHA = '0b63802cd1c2bb9be268b9aa67c5d36494307df8'

test('find template files', async () => {
  const {templates, partials} = await findTemplates(TEMPLATES_DIR, PARTIALS_DIR)

  expect(templates).toEqual([
    path.resolve(
      process.cwd(),
      './__tests__/fixtures/templates/nested/template.hbs'
    ),
    path.resolve(process.cwd(), './__tests__/fixtures/templates/template.hbs')
  ])

  expect(partials).toEqual([
    path.resolve(
      process.cwd(),
      './__tests__/fixtures/templates/partials/footer.hbs'
    ),
    path.resolve(
      process.cwd(),
      './__tests__/fixtures/templates/partials/header.hbs'
    ),
    path.resolve(
      process.cwd(),
      './__tests__/fixtures/templates/partials/nested/block.hbs'
    )
  ])
})

test('getTemplateName', async () => {
  const tplName = getTemplateName(TEMPLATES_DIR, path.resolve(process.cwd(), './__tests__/fixtures/templates/template.hbs'))
  const tplName2 = getTemplateName(TEMPLATES_DIR, path.resolve(process.cwd(), './__tests__/fixtures/templates/nested/template.hbs'))

  const partialName = getTemplateName(PARTIALS_DIR, path.resolve(process.cwd(), './__tests__/fixtures/templates/partials/header.hbs'))
  const partialName2 = getTemplateName(PARTIALS_DIR, path.resolve(process.cwd(), './__tests__/fixtures/templates/partials/nested/block.hbs'))

  expect(tplName).toEqual('template')
  expect(tplName2).toEqual('nested/template')

  expect(partialName).toEqual('header')
  expect(partialName2).toEqual('nested/block')
})

test('list template partial dependencies', async () => {
  const partialDeps = await getTemplatePartialDeps(path.resolve(process.cwd(), './__tests__/fixtures/templates/template.hbs'))
  expect(partialDeps).toEqual(['header', 'nested/block', 'footer'])
})

test('dependency mappings', async () => {
  const {templates} = await findTemplates(TEMPLATES_DIR, PARTIALS_DIR)
  const deps = await getDependencyMaps(TEMPLATES_DIR, templates)

  expect(deps).toEqual({
    templateDeps: {
      'nested/template': [ 'header', 'nested/block' ],
      template: [ 'header', 'nested/block', 'footer' ]
    },
    partialDeps: {
      header: [ 'nested/template', 'template' ],
      'nested/block': [ 'nested/template', 'template' ],
      footer: [ 'template' ]
    }
  })
})

// test('diff from sha', async () => {
//   const diff = await getDiffFromCommit(TEST_SHA)
//   expect(diff).toEqual({
//     addedFiles: [
//       'src/findFiles.ts',
//       'src/partialCompileHandlebars.ts',
//       'yarn.lock'
//     ],
//     deletedFiles: ['src/wait.ts'],
//     modifiedFiles: [
//       'README.md',
//       '__tests__/main.test.ts',
//       'action.yml',
//       'package.json',
//       'src/main.ts'
//     ]
//   })
// })

test('test runs', () => {
  process.env['ACTIONS_RUNNER_DEBUG'] = 'true'
  process.env['INPUT_TEMPLATESDIR'] = TEMPLATES_DIR
  process.env['INPUT_PARTIALSDIR'] = PARTIALS_DIR
  process.env['GITHUB_REPOSITORY'] = 'nanopx/action-sendgrid-sync'
  process.env['GITHUB_SHA'] = TEST_SHA

  const np = process.execPath
  const ip = path.join(__dirname, '..', 'lib', 'main.js')
  const options: cp.ExecFileSyncOptions = {
    env: process.env
  }

  // eslint-disable-next-line no-console
  console.log(cp.execFileSync(np, [ip], options).toString())
})
