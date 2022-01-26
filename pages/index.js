import Head from 'next/head'
import Dropdown from "../components/Dropdown";
import {useEffect, useState} from "react";
import axios from 'redaxios';
import TokenList from "../components/TokenList";
import Metamask from "../components/Metamask";
import {useWeb3React} from "@web3-react/core";

const TX_LOCALSTORAGE = "tx";
const NATIVE_ADDRESS_TOKEN = "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee";

export default function Home() {
    const {active, account, library} = useWeb3React()

    const [inputNetwork, setInputNetwork] = useState(1); // Ethereum
    const [outputNetwork, setOutputNetwork] = useState(10); // Optimism
    const [networks, setNetworks] = useState([]);
    const [walletTokens, setWalletTokens] = useState([]);

    const [inputTokens, setInputTokens] = useState([]);
    const [outputTokens, setOutputTokens] = useState([]);

    const [inputToken, setInputToken] = useState({});
    const [balanceInputToken, setBalanceInputToken] = useState(0);
    const [balanceOutputToken, setBalanceOutputToken] = useState(0);

    const [outputToken, setOutputToken] = useState({});
    const [inputAmount, setInputAmount] = useState(-1);
    const [outputAmount, setOutputAmount] = useState(-1);

    // Quote
    const [quote, setQuote] = useState(null);
    const [estimateGasFee, setEstimateGasFee] = useState(0);
    const [estimateBridgeFee, setEstimateBridgeFee] = useState(0);
    const [estimateBridgeTime, setEstimateBridgeTime] = useState(0);

    // Allowance
    const [allowance, setAllowance] = useState(null);

    // Btn
    const [textBtn, setTextBtn] = useState("Select route");
    const [btnDisable, setBtnDisable] = useState(true);

    // Status of tx move
    const [status, setStatusMove] = useState(null);

    /**
     * Load networks
     */
    useEffect(async () => {
        const res = await axios.get("https://backend.movr.network/v1/supported/chains");
        setNetworks(res.data.result);
    }, []);

    /**
     * Load tokens list into user wallet (all networks)
     */
    useEffect(async () => {
        const res = await axios.get(`https://backend.movr.network/v1/balances?userAddress=${account}`);
        setWalletTokens(res.data.result);
    }, [account]);

    /**
     * List tokens available to send from inputNetwork to outputNetwork
     */
    useEffect(async () => {
        const res = await axios.get(`https://backend.movr.network/v1/supported/from-token-list?fromChainId=${inputNetwork}&toChainId=${outputNetwork}`);
        setInputTokens(res.data.result);
    }, [inputNetwork, outputNetwork]);

    /**
     * List tokens available to send from outputNetwork to inputNetwork
     */
    useEffect(async () => {
        const res = await axios.get(`https://backend.movr.network/v1/supported/to-token-list?fromChainId=${inputNetwork}&toChainId=${outputNetwork}`);
        setOutputTokens(res.data.result);
    }, [inputNetwork, outputNetwork]);

    /**
     * Set input token balance when it changed
     */
    useEffect(() => {
        const amount = walletTokens.filter(wt => wt.address === inputToken.address && wt.chainId === inputToken.chainId)[0]?.amount || 0;
        setBalanceInputToken(amount);
    }, [inputToken]);

    /**
     * Set output token balance when it changed
     */
    useEffect(() => {
        const amount = walletTokens.filter(wt => wt.address === outputToken.address)[0]?.amount || 0;
        setBalanceOutputToken(amount);
    }, [outputToken]);

    /**
     * Get quotes
     */
    useEffect(async () => {
        await doQuote();
    }, [inputToken, outputToken, inputAmount]);

    const doQuote = async () => {
        if (!inputToken.address || !outputToken.address || inputAmount <= 0) {
            return;
        }

        setBtnDisable(true);
        setTextBtn("Fetching quote ...");

        const amount = parseInt(inputAmount * Math.pow(10, inputToken.decimals));

        let res;
        try {
            res = await axios.get(`https://backend.movr.network/v1/quote?fromAsset=${inputToken.address}&fromChainId=${inputNetwork}&toAsset=${outputToken.address}&toChainId=${outputNetwork}&amount=${amount}&sort=cheapestRoute`);
        } catch (e) {
            setBtnDisable(false);
            setTextBtn("No Routes Available");
            return;
        }

        const quote = res.data.result;

        console.log(quote);

        if (quote.routes.length === 0) {
            setBtnDisable(false);
            setTextBtn("No Routes Available or sending amount is too small (try > $100)");
            return;
        }

        const route = quote.routes[0];

        res = await axios.get(`https://backend.movr.network/v1/approval/check-allowance?chainID=${inputNetwork}&owner=${account}&allowanceTarget=${route.allowanceTarget}&tokenAddress=${inputToken.address}`);
        const allowance = res.data.result;

        const bridgeRoute = route.bridgeRoute;
        const needApprove = allowance.value === "0";

        const inputGasPricePerByte = await getGasPricePerByte(inputNetwork);

        const fromAssetBridge = route.bridgeRoute.fromAsset;
        const respTokenPayPrice = await axios.get(`https://backend.movr.network/v1/token-price?tokenAddress=${route.fees.bridgeFee.assetAddress}&chainId=${fromAssetBridge.chainId}`);
        const tokenPayPrice = respTokenPayPrice.data.result.tokenPrice;
        const estimateBridgeFee = tokenPayPrice * route.fees.bridgeFee.amount / Math.pow(10, fromAssetBridge.decimals);

        setQuote(quote);
        setEstimateGasFee(route.fees.gasLimit[0].amount * inputGasPricePerByte);
        setEstimateBridgeFee(estimateBridgeFee);
        setEstimateBridgeTime(route.bridgeRoute.bridgeInfo.serviceTime / 1000 / 60);
        setOutputAmount(bridgeRoute.outputAmount / Math.pow(10, bridgeRoute.toAsset.decimals));
        setAllowance(needApprove ? allowance : null);
        setBtnDisable(false);
        setTextBtn(needApprove ? "Approve token" : "Move");
    };

    // Select networks
    const onSelectInputNetwork = id => setInputNetwork(id);
    const onSelectOutputNetwork = id => setOutputNetwork(id);

    // Select token to bridge / swap
    const onSelectInputToken = token => setInputToken(token);
    const onSelectOutputToken = token => setOutputToken(token);

    // Max button
    const setMaxBalance = () => setInputAmount(balanceInputToken);

    const onChangeInputBalance = e => setInputAmount(parseFloat(e.target.value));

    const sendAllowance = async () => {
        let resp = await axios.get(`https://backend.movr.network/v1/gas-price?chainId=${inputNetwork}`);
        const gasPrice = resp.data.result.fast.gasPrice;

        // Generate tx
        const amount = parseInt(inputAmount * Math.pow(10, inputToken.decimals));
        const res = await axios.get(`https://backend.movr.network/v1/approval/build-tx?chainID=${inputNetwork}&owner=${account}&allowanceTarget=${quote.routes[0].allowanceTarget}&tokenAddress=${inputToken.address}&amount=${amount}`);
        const data = res.data.result.data;

        await library.eth.sendTransaction({
            from: account,
            data: data,
            to: res.data.result.to,
            gasPrice
        });

        await doQuote();
    };

    const sendTx = async () => {
        const route = quote.routes[0];

        const bridgeRoute = route.bridgeRoute;
        const output = bridgeRoute.outputAmount;
        let res = await getRouteTransactionData(account, quote.fromAsset.address, quote.fromChainId, quote.toAsset.address, quote.toChainId, quote.amount, output, account, route.routePath);

        setBtnDisable(true);

        let opts;
        if (inputNetwork === 1) {
            opts = {
                from: account,
                to: res.tx.to,
                data: res.tx.data,
                gas: route.fees.gasLimit[0].amount,
            };
        } else {
            const resp = await axios.get(`https://backend.movr.network/v1/gas-price?chainId=${inputNetwork}`);
            const gasPrice = resp.data.result.fast.gasPrice;
            opts = {
                from: account,
                to: res.tx.to,
                data: res.tx.data,
                gasPrice,
            };
        }

        const tx = await library.eth.sendTransaction(opts);

        const idInterval = setInterval(async () => {
            const resp = await axios.get(`https://watcherapi.fund.movr.network/api/v1/transaction-status?transactionHash=${tx.transactionHash}&fromChainId=${inputNetwork}&toChainId=${outputNetwork}`);
            const status = resp.data.result;
            if (status.destinationTxStatus === "COMPLETED") {
                setBtnDisable(false);
                clearInterval(idInterval);
                setStatusMove(null);
                return;
            }

            setStatusMove(status);
        }, 5000);
    };

    // Makes an API call to FundMovr API with parameters
    const getRouteTransactionData = async (recipient, fromAsset, fromChainId, toAsset, toChainId, amount, output, fromAddress, routePath) => {
        const response = await axios.get(`https://backend.movr.network/v1/send/build-tx?recipient=${recipient}&fromAsset=${fromAsset}&fromChainId=${fromChainId}&toAsset=${toAsset}&toChainId=${toChainId}&amount=${amount}&output=${output}&fromAddress=${fromAddress}&routePath=${routePath}`, {});
        return response.data.result;
    }

    const getGasPricePerByte = async (networkId) => {
        const nativeToken = inputTokens.filter(t => t.token.address === NATIVE_ADDRESS_TOKEN)[0];

        let resp = await axios.get(`https://backend.movr.network/v1/gas-price?chainId=${networkId}`);
        const gasPrice = resp.data.result.fast.gasPrice;

        resp = await axios.get(`https://backend.movr.network/v1/token-price?tokenAddress=${NATIVE_ADDRESS_TOKEN}&chainId=${networkId}`);
        const tokenPrice = resp.data.result.tokenPrice;

        return tokenPrice * gasPrice / Math.pow(10, nativeToken.token.decimals);
    }

    if (!active) {
        return <div className="flex flex-col justify-between text-white rounded-lg dark w-1/2">
            <div className={"w-full flex flex-row justify-between"}>
                <Metamask/>
            </div>
        </div>;
    }

    let statusBlock = null;
    if (status) {
        statusBlock = <div className={"w-full flex flex-col justify-between p-6"}>
            <div className={"flex flex-col w-full justify-center align-center"}>
                <p>Tx : {status.sourceTx}</p>
                <p>Source Tx : {status.sourceTxStatus === "COMPLETED" ? "Confirmed" : "Pending"}</p>
                <p>Destination Tx : {status.destinationTxStatus === "COMPLETED" ? "Confirmed" : "Pending"}</p>
            </div>
        </div>
    }

    return (
        <div className="flex flex-col justify-between text-white rounded-lg dark w-1/2">
            <div className={"w-full flex flex-row justify-between"}>
                <Metamask network={inputNetwork}/>
            </div>
            <div className={"w-full flex flex-row justify-between"}>
                <div className={"flex flex-col justify-start p-6"}>
                    <h3>Transfer from</h3>
                    <Dropdown items={networks} selected={inputNetwork} onClick={onSelectInputNetwork}/>
                </div>
                <div className={"flex flex-col justify-start p-6"}>
                    <h3>Transfer to</h3>
                    <Dropdown items={networks} selected={outputNetwork} onClick={onSelectOutputNetwork}/>
                </div>
            </div>
            <div className={"w-full flex flex-col justify-between"}>
                <div className={"flex flex-col justify-start p-6"}>
                    <div className={"flex flex-row justify-between"}>
                        <h3>You send</h3>
                        <p>Balance : {balanceInputToken}</p>
                    </div>
                    <div
                        className={"h-11 my-2 flex flex-row justify-between items-center border rounded-xl border-gray-200 overflow-hidden"}>
                        <input type="number"
                               placeholder="0.0"
                               className="px-3 h-full font-bold text-black xl:w-1/2 focus:outline-none flex-1"
                               value={inputAmount > -1 ? inputAmount : "0.0"}
                               onChange={onChangeInputBalance}
                        />
                        <p className="text-xs font-medium text-secondarydark cursor-pointer mr-2 maxButton"
                           onClick={setMaxBalance}>
                            MAX
                        </p>
                        <TokenList
                            walletTokens={walletTokens}
                            filter={true}
                            tokensAvailable={inputTokens}
                            chainId={inputNetwork}
                            selectedToken={inputToken}
                            onClick={onSelectInputToken}
                        />
                    </div>
                </div>
                <div className={"flex flex-col justify-start p-6"}>
                    <div className={"flex flex-row justify-between"}>
                        <h3>You receive</h3>
                        <p>Balance : {balanceOutputToken}</p>
                    </div>
                    <div
                        className={"h-11 my-2 flex flex-row justify-between items-center border rounded-xl border-gray-200 overflow-hidden"}>
                        <input type="number" placeholder="0.0"
                               className="px-3 h-full font-bold text-black xl:w-1/2 focus:outline-none flex-1"
                               value={outputAmount > -1 ? outputAmount : "0.0"}
                               disabled={true}/>
                        <TokenList
                            walletTokens={walletTokens}
                            filter={false}
                            tokensAvailable={outputTokens}
                            chainId={outputNetwork}
                            selectedToken={outputToken}
                            onClick={onSelectOutputToken}
                        />
                    </div>
                </div>
            </div>
            <div className={"w-full flex flex-col justify-between p-6"}>
                <div className={"flex flex-row justify-between"}>
                    <p>Estimated Gas Fee</p>
                    <p>${estimateGasFee}</p>
                </div>
                <div className={"flex flex-row justify-between"}>
                    <p>Estimated Bridge Fee</p>
                    <p>${estimateBridgeFee}</p>
                </div>
                <div className={"flex flex-row justify-between"}>
                    <p>Estimated Bridge time</p>
                    <p>{estimateBridgeTime} minutes</p>
                </div>
            </div>
            <div className={"w-full flex flex-col justify-between p-6"}>
                <div className={"flex flex-row w-full justify-center align-center"}>
                    <button
                        disabled={btnDisable}
                        onClick={allowance ? sendAllowance : sendTx}
                        className={"w-full  rounded-lg text-center pt-3 pb-3 " + (btnDisable ? "bg-slate-400" : "bg-gray-600")}>
                        {textBtn}
                    </button>
                </div>
            </div>
            {statusBlock}
        </div>
    )
}
