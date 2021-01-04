import path from 'path'
import git from 'nodegit'

export const getTemplateDiffFromCommit = async (
  commitSha: string
): Promise<{
  added: string[]
  modified: string[]
  deleted: string[]
  renamed: {from: string; to: string}[]
}> => {
  const repo = await git.Repository.open(process.cwd())

  const commit = await repo.getCommit(commitSha)

  const diffList = await commit.getDiff()

  const patchList = (
    await Promise.all(diffList.map(async d => d.patches()))
  ).reduce((acc, p) => [...acc, ...p], [])

  const {added, modified, deleted, renamed} = patchList.reduce(
    (acc, p) => {
      const filePath = path.resolve(process.cwd(), p.newFile().path())
      if (!filePath.endsWith('.hbs')) return acc

      return {
        added: p.isAdded() ? [...acc.added, filePath] : acc.added,
        modified: p.isModified() ? [...acc.modified, filePath] : acc.modified,
        deleted: p.isDeleted() ? [...acc.deleted, filePath] : acc.deleted,
        renamed: p.isRenamed()
          ? [
              ...acc.renamed,
              {
                from: path.resolve(process.cwd(), p.oldFile().path()),
                to: filePath
              }
            ]
          : acc.renamed
      }
    },
    {
      added: [] as string[],
      modified: [] as string[],
      deleted: [] as string[],
      renamed: [] as {from: string; to: string}[]
    }
  )

  return {added, modified, deleted, renamed}
}
