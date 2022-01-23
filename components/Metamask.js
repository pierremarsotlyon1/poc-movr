import {InjectedConnector} from '@web3-react/injected-connector';
import {useWeb3React} from "@web3-react/core"
import {useEffect, useState} from "react";
import axios from "redaxios";

export default function Metamask(props) {
    const {active, connector, activate, deactivate, chainId} = useWeb3React()
    const [injected, setInjected] = useState(null);

    useEffect(async () => {
        const res = await axios.get("https://backend.movr.network/v1/supported/chains");
        const chainIds = res.data.result.map(r => r.chainId);
        setInjected(new InjectedConnector({
            supportedChainIds: chainIds,
        }));

        connect();
    }, []);

    const connect = async () => {
        try {
            if (!injected) {
                return;
            }
            await activate(injected)
        } catch (ex) {
            console.log(ex)
        }
    }

    const disconnect = async () => {
        try {
            await deactivate()
        } catch (ex) {
            console.log(ex)
        }
    }

    const changeNetwork = async () => {
        connector.getProvider().then(provider => {
            provider
                .request({
                    method: 'wallet_switchEthereumChain',
                    params: [{chainId: "0x" + props.network.toString(16)}]
                });
        })
    };

    if (props.network !== chainId) {
        return <div className="w-full flex flex-col items-center justify-center">
            <button onClick={changeNetwork}
                    className="py-2 mt-6 mb-4 text-lg font-bold text-white rounded-lg w-56 bg-blue-600 hover:bg-blue-800">
                Connect to correct network
            </button>
        </div>
    }

    if (active) {
        return <div className="w-full flex flex-col items-center justify-center">
            <button onClick={disconnect}
                    className="py-2 mt-6 mb-4 text-lg font-bold text-white rounded-lg w-56 bg-blue-600 hover:bg-blue-800">Disconnect
            </button>
        </div>
    }

    return (
        <div className="w-full flex flex-col items-center justify-center">
            <button onClick={connect}
                    className="py-2 mt-6 mb-4 mb-4 text-lg font-bold text-white rounded-lg w-56 bg-blue-600 hover:bg-blue-800">Connect
                to MetaMask
            </button>

        </div>
    )
}