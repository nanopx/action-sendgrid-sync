import path from 'path'
import git from 'nodegit'

export const getTemplateDiffFromCommit = async (
  commitSha: string
): Promise<{
  addedFiles: string[]
  modifiedFiles: string[]
  deletedFiles: string[]
}> => {
  const repo = await git.Repository.open(process.cwd())

  const commit = await repo.getCommit(commitSha)

  const diffList = await commit.getDiff()

  const patchList = (
    await Promise.all(diffList.map(async d => d.patches()))
  ).reduce((acc, p) => [...acc, ...p], [])

  const {addedFiles, modifiedFiles, deletedFiles} = patchList.reduce(
    (acc, p) => {
      const filePath = path.resolve(process.cwd(), p.newFile().path())
      if (!filePath.endsWith('.hbs')) return acc

      return {
        addedFiles: p.isAdded()
          ? [...acc.addedFiles, filePath]
          : acc.addedFiles,
        modifiedFiles: p.isModified()
          ? [...acc.modifiedFiles, filePath]
          : acc.modifiedFiles,
        deletedFiles: p.isDeleted()
          ? [...acc.deletedFiles, filePath]
          : acc.deletedFiles
      }
    },
    {
      addedFiles: [] as string[],
      modifiedFiles: [] as string[],
      deletedFiles: [] as string[]
    }
  )

  return {addedFiles, modifiedFiles, deletedFiles}
}
