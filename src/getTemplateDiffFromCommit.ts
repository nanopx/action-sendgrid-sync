import path from 'path'
import * as github from '@actions/github'
import * as core from '@actions/core'

const {owner, repo} = github.context.repo

export interface TemplateChanges {
  added: string[]
  modified: string[]
  deleted: string[]
  renamed: {from: string; to: string}[]
}

export const getTemplateDiffFromCommit = async (
  ref: string
): Promise<TemplateChanges> => {
  const gh = github.getOctokit(core.getInput('githubToken'))

  const {data} = await gh.repos.getCommit({
    owner,
    repo,
    ref
  })

  core.debug(`Committed template files:`)

  return (data?.files ?? []).reduce(
    (acc, file) => {
      const filePath = path.resolve(process.cwd(), file.filename as string)
      if (!filePath.endsWith('.hbs')) return acc

      core.debug(`  - ${file.status}: ${filePath} `)

      return {
        ...acc,
        added: file.status === 'added' ? [...acc.added, filePath] : acc.added,
        modified:
          file.status === 'modified'
            ? [...acc.modified, filePath]
            : acc.modified,
        deleted:
          file.status === 'removed' ? [...acc.deleted, filePath] : acc.deleted,
        renamed:
          file.status === 'renamed'
            ? [
                ...acc.renamed,
                {
                  from: path.resolve(
                    process.cwd(),
                    file.previous_filename as string
                  ),
                  to: filePath
                }
              ]
            : acc.renamed
      }
    },
    {
      added: [],
      modified: [],
      deleted: [],
      renamed: []
    } as TemplateChanges
  )
}
