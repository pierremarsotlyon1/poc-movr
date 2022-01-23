import '../styles/global.css'

import Head from 'next/head'
import { Web3ReactProvider } from '@web3-react/core'
import Web3 from 'web3'

function getLibrary(provider) {
    return new Web3(provider)
}

export default function MyApp({Component, pageProps}) {

    return <Web3ReactProvider getLibrary={getLibrary}>
        <Head>
            <title>POC Movr</title>
            <link rel="icon" href="/favicon.ico"/>
        </Head>
        <div className='bg-black'>
            <Component {...pageProps} />
        </div>
    </Web3ReactProvider>

}