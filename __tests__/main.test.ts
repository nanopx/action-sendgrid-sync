import * as process from 'process'
import * as cp from 'child_process'
import * as path from 'path'
import {findTemplates} from '../src/findTemplates'
// import {getDiffFromCommit} from '../src/getDiffFromCommit'

jest.setTimeout(1000 * 60) // 60sec

const TEMPLATES_DIR = './__tests__/fixtures/templates/'
const PARTIALS_DIR = './__tests__/fixtures/templates/partials/'
const TEST_SHA = 'ef26051771b839bf19b10a220a1dfe1645a6756f'

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
    )
  ])
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
