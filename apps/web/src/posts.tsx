import axios from 'redaxios'

async function loaderDelayFn<T>(fn: (...args: Array<any>) => Promise<T> | T) {
    const delay = Number(sessionStorage.getItem('loaderDelay') ?? 0)
    const delayPromise = new Promise((r) => setTimeout(r, delay))

    await delayPromise
    const res = await fn()

    return res
}

type Invoice = {
    id: number
    title: string
    body: string
}

let invoices: Array<Invoice> = null!

let invoicesPromise: Promise<void> | undefined = undefined

const ensureInvoices = async () => {
    if (!invoicesPromise) {
        invoicesPromise = Promise.resolve().then(async () => {
            const { data } = await axios.get(
                'https://jsonplaceholder.typicode.com/posts',
            )
            invoices = data.slice(0, 10)
        })
    }

    await invoicesPromise
}

export async function fetchInvoices() {
    return loaderDelayFn(() => ensureInvoices().then(() => invoices))
}

export async function fetchInvoiceById(id: number) {
    return loaderDelayFn(() =>
        ensureInvoices().then(() => {
            const invoice = invoices.find((d) => d.id === id)
            if (!invoice) {
                throw new Error('Invoice not found')
            }
            return invoice
        }),
    )
}

export type PostType = {
    id: string
    title: string
    body: string
}

export const fetchPost = async (postId: string) => {
    console.info(`Fetching post with id ${postId}...`)
    await new Promise((r) => setTimeout(r, 100))
    const post = await axios
        .get<PostType>(`https://jsonplaceholder.typicode.com/posts/${postId}`)
        .then((r) => r.data)
        .catch((err) => {
            if (err.status === 404) {
                throw new Error(`Post with id "${postId}" not found!`)
            }
            throw err
        })

    return post
}

export const fetchPostSlow = async (postId: string) => {
    console.info(`Fetching post with id ${postId}...`)
    await new Promise((r) => setTimeout(r, 3000))
    const post = await axios
        .get<PostType>(`https://jsonplaceholder.typicode.com/posts/${postId}`)
        .then((r) => r.data)
        .catch((err) => {
            if (err.status === 404) {
                throw new Error(`Post with id "${postId}" not found!`)
            }
            throw err
        })

    return post
}

export const fetchPosts = async () => {
    console.info('Fetching posts...')
    await new Promise((r) => setTimeout(r, 500))
    return axios
        .get<Array<PostType>>('https://jsonplaceholder.typicode.com/posts')
        .then((r) => r.data.slice(0, 10))
}