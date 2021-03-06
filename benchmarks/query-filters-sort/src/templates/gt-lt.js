import React from "react"
import { graphql } from "gatsby"

export default ({ data }) => {
  if (!data?.allTest?.nodes) {
    throw new Error("Wrong data: " + JSON.stringify(data))
  }
  return <div>{JSON.stringify(data)}</div>
}

export const query = graphql`
  query($pageNum: Int, $pagesTotal: Int, $sort: TestSortInput) {
    allTest(
      filter: { nodeNum: { gt: $pageNum, lt: $pagesTotal } }
      sort: $sort
      limit: 100
    ) {
      nodes {
        nodeNum
        text
      }
    }
  }
`
