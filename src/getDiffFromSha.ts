import git, {ConvenientPatch} from 'nodegit'

export const getDiffFromSha = async (
  commitSha: string
): Promise<{
  addedFiles: string[]
  modifiedFiles: string[]
  deletedFiles: string[]
}> => {
  const repo = await git.Repository.open(process.cwd())
  const commit = await repo.getCommit(commitSha)
  const diffList = await commit.getDiff()
  const patchList = await diffList.reduce(async (acc, d) => {
    const prev = await acc
    const patches = await d.patches()
    return [...prev, ...patches]
  }, Promise.resolve([] as ConvenientPatch[]))

  const addedFiles = patchList
    .filter(p => p.isAdded())
    .map(p => p.newFile().path())
  const modifiedFiles = patchList
    .filter(p => p.isModified())
    .map(p => p.newFile().path())
  const deletedFiles = patchList
    .filter(p => p.isDeleted())
    .map(p => p.oldFile().path())

  return {addedFiles, modifiedFiles, deletedFiles}
}
