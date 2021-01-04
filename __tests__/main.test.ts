import * as process from 'process'
import * as cp from 'child_process'
import * as path from 'path'
import {
  createGenerateChangeset,
  getTemplatePartialDeps,
  getTemplateName,
  getDependencyMaps,
  findTemplates
} from '../src/setupHandlebars'
// import {getDiffFromCommit} from '../src/getDiffFromCommit'

jest.setTimeout(1000 * 60) // 60sec

const TEMPLATES_DIR = './__tests__/fixtures/templates/'
const PARTIALS_DIR = './__tests__/fixtures/templates/partials/'
const TEST_SHA = 'ce7c20a60b2715b8f3a217e54607df4eaa0c424d' // '0b63802cd1c2bb9be268b9aa67c5d36494307df8'

const getFixturePath = (file: string) =>
  path.resolve(process.cwd(), './__tests__/fixtures', file)
const getTemplatesPath = (file: string) => getFixturePath(`templates/${file}`)

test('find template files', async () => {
  const {templates, partials} = await findTemplates(TEMPLATES_DIR, PARTIALS_DIR)

  expect(templates).toEqual([
    getTemplatesPath('nested/template.hbs'),
    getTemplatesPath('template.hbs')
  ])

  expect(partials).toEqual([
    getTemplatesPath('partials/footer.hbs'),
    getTemplatesPath('partials/header.hbs'),
    getTemplatesPath('partials/nested/block.hbs')
  ])
})

test('getTemplateName', async () => {
  const tplName = getTemplateName(
    TEMPLATES_DIR,
    getTemplatesPath('template.hbs')
  )
  const tplName2 = getTemplateName(
    TEMPLATES_DIR,
    getTemplatesPath('nested/template.hbs')
  )

  const partialName = getTemplateName(
    PARTIALS_DIR,
    getTemplatesPath('partials/header.hbs')
  )
  const partialName2 = getTemplateName(
    PARTIALS_DIR,
    getTemplatesPath('partials/nested/block.hbs')
  )

  expect(tplName).toEqual('template')
  expect(tplName2).toEqual('nested/template')

  expect(partialName).toEqual('header')
  expect(partialName2).toEqual('nested/block')
})

test('list template partial dependencies', async () => {
  const partialDeps = await getTemplatePartialDeps(
    getTemplatesPath('template.hbs')
  )
  expect(partialDeps).toEqual(['header', 'nested/block', 'footer'])
})

test('dependency mappings', async () => {
  const {templates} = await findTemplates(TEMPLATES_DIR, PARTIALS_DIR)
  const deps = await getDependencyMaps(TEMPLATES_DIR, templates)

  expect(deps).toEqual({
    templateDeps: {
      'nested/template': ['header', 'nested/block'],
      template: ['header', 'nested/block', 'footer']
    },
    partialDeps: {
      header: ['nested/template', 'template'],
      'nested/block': ['nested/template', 'template'],
      footer: ['template']
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

describe('Calculate template changes', () => {
  let generateChangeset: any = null

  beforeAll(async () => {
    generateChangeset = createGenerateChangeset(
      TEMPLATES_DIR,
      PARTIALS_DIR,
      [
        getTemplatesPath('nested/template.hbs'),
        getTemplatesPath('template.hbs'),
        getTemplatesPath('nested/templateFoo.hbs')
      ],
      [
        getTemplatesPath('partials/header.hbs'),
        getTemplatesPath('partials/footer.hbs')
      ],
      {
        templateDeps: {},
        partialDeps: {
          header: ['template', 'nested/template'],
          footer: ['template']
        }
      }
    )
  })

  test('return correct template changes when no changes', async () => {
    expect(generateChangeset({})).toEqual({
      created: [],
      updated: [],
      deleted: [],
      renamed: []
    })
  })

  test('return correct template changes when template added', async () => {
    expect(
      generateChangeset({
        added: [getTemplatesPath('template.hbs')]
      })
    ).toEqual({
      created: ['template'],
      updated: [],
      deleted: [],
      renamed: []
    })
  })

  test('return correct template changes when partial added', async () => {
    expect(
      generateChangeset({
        added: [getTemplatesPath('partials/footer.hbs')]
      })
    ).toEqual({
      created: [],
      // NOTE: template depends on footer
      updated: ['template'],
      deleted: [],
      renamed: []
    })
  })

  test('return correct template changes when partial and template added', async () => {
    expect(
      generateChangeset({
        added: [
          getTemplatesPath('template.hbs'),
          getTemplatesPath('partials/footer.hbs')
        ]
      })
    ).toEqual({
      created: ['template'],
      updated: [],
      deleted: [],
      renamed: []
    })
  })

  test('return correct template changes when template modified', async () => {
    expect(
      generateChangeset({
        modified: [getTemplatesPath('nested/template.hbs')]
      })
    ).toEqual({
      created: [],
      updated: ['nested/template'],
      deleted: [],
      renamed: []
    })
  })

  test('return correct template changes when partial modified', async () => {
    expect(
      generateChangeset({
        modified: [getTemplatesPath('partials/footer.hbs')]
      })
    ).toEqual({
      created: [],
      updated: ['template'],
      deleted: [],
      renamed: []
    })
  })

  test('return correct template changes when template and partial modified', async () => {
    expect(
      generateChangeset({
        modified: [
          getTemplatesPath('template.hbs'),
          getTemplatesPath('partials/footer.hbs')
        ]
      })
    ).toEqual({
      created: [],
      updated: ['template'],
      deleted: [],
      renamed: []
    })
  })

  test('return correct template changes when template deleted', async () => {
    expect(
      generateChangeset({
        deleted: [getTemplatesPath('nested/template.hbs')]
      })
    ).toEqual({
      created: [],
      updated: [],
      deleted: ['nested/template'],
      renamed: []
    })
  })

  test('return correct template changes when partial deleted', async () => {
    expect(
      generateChangeset({
        deleted: [getTemplatesPath('partials/footer.hbs')]
      })
    ).toEqual({
      created: [],
      updated: ['template'],
      deleted: [],
      renamed: []
    })
  })

  test('return correct template changes when template and partial deleted', async () => {
    expect(
      generateChangeset({
        deleted: [
          getTemplatesPath('template.hbs'),
          getTemplatesPath('nested/template.hbs'),
          getTemplatesPath('partials/footer.hbs')
        ]
      })
    ).toEqual({
      created: [],
      updated: [],
      deleted: ['nested/template', 'template'],
      renamed: []
    })
  })

  test('return correct template changes when template and partial deleted', async () => {
    expect(
      generateChangeset({
        deleted: [
          getTemplatesPath('nested/template.hbs'),
          getTemplatesPath('partials/footer.hbs')
        ]
      })
    ).toEqual({
      created: [],
      updated: ['template'],
      deleted: ['nested/template'],
      renamed: []
    })
  })

  test('return correct template changes when template renamed', async () => {
    expect(
      generateChangeset({
        modified: [getTemplatesPath('nested/template.hbs')],
        renamed: [
          {
            from: getTemplatesPath('nested/templateFoo.hbs'),
            to: getTemplatesPath('nested/template.hbs')
          }
        ]
      })
    ).toEqual({
      created: [],
      updated: ['nested/template'],
      deleted: [],
      renamed: [{from: 'nested/templateFoo', to: 'nested/template'}]
    })
  })
})

test('test runs', () => {
  process.env['ACTIONS_RUNNER_DEBUG'] = 'true'
  process.env['INPUT_TEMPLATESDIR'] = TEMPLATES_DIR
  process.env['INPUT_PARTIALSDIR'] = PARTIALS_DIR
  process.env['INPUT_DRYRUN'] = 'true'
  process.env['GITHUB_REPOSITORY'] = 'nanopx/action-sendgrid-sync'
  process.env['GITHUB_SHA'] = TEST_SHA
  process.env['GITHUB_REF'] = 'refs/heads/main'

  const np = process.execPath
  const ip = path.join(__dirname, '..', 'lib', 'main.js')
  const options: cp.ExecFileSyncOptions = {
    env: process.env
  }

  // eslint-disable-next-line no-console
  console.log(cp.execFileSync(np, [ip], options).toString())
})
