import { getNode } from "../../../../datastore"
import { store } from "../../../../redux"
import { IGatsbyPage } from "../../../../redux/types"
import reporter from "gatsby-cli/lib/reporter"

// re-export all usual methods from production worker
export * from "../../child"

// additional functions to be able to write assertions that won't be available in production code

// test: datastore
export function getNodeFromWorker(nodeId: string): ReturnType<typeof getNode> {
  return getNode(nodeId)
}

// test:share-state
export function getPage(pathname: string): IGatsbyPage | undefined {
  return store.getState().pages.get(pathname)
}

// test: reporter
export function log(message: string): boolean {
  reporter.log(message)
  return true
}
