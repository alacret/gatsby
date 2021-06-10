import React from "react"
import { graphql } from "gatsby"

export default ({ data }) => {
  if (!data?.allTest?.nodes) {
    throw new Error("Bad query result")
  }
  return <div>{JSON.stringify(data)}</div>
}

export const query = graphql`
  query($fooBar: String!, $sort: TestSortInput) {
    allTest(filter: { fooBar: { eq: $fooBar } }, sort: $sort, limit: 100) {
      nodes {
        nodeNum
        text
      }
    }
  }
`
