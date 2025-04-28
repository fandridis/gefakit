// import { queryOptions } from '@tanstack/react-query'
// import { fetchPosts } from './posts'

// export const postsQueryOptions = queryOptions({
//     queryKey: ['posts'],
//     queryFn: () => fetchPosts(),
// })


import { queryOptions } from '@tanstack/react-query'
import { fetchPost, fetchPostSlow } from './posts'

export const postQueryOptions = (postId: string) =>
    queryOptions({
        queryKey: ['posts', { postId }],
        queryFn: () => fetchPost(postId),
    })


export const slowPostQueryOptions = (postId: string) =>
    queryOptions({
        queryKey: ['posts-details', { postId }],
        queryFn: () => fetchPostSlow(postId),
    })