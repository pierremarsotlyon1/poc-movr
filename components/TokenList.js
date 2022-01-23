import {Fragment} from 'react'
import {Menu, Transition} from '@headlessui/react'
import {ChevronDownIcon} from '@heroicons/react/solid'

function classNames(...classes) {
    return classes.filter(Boolean).join(' ')
}

export default function TokenList(props) {

    const tokenName = props.selectedToken?.symbol || "";
    let tokensAvailable = props.tokensAvailable;
    if (props.filter) {
        tokensAvailable = tokensAvailable
            .filter(token => props.walletTokens.some(wt => wt.address === token.token.address && wt.amount > 0));
    }

    return (
        <Menu as="div" className="">
            <div>
                <Menu.Button
                    className="inline-flex justify-center w-28 rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-100 focus:ring-indigo-500">
                    {tokenName}
                    <ChevronDownIcon className="-mr-1 ml-2 h-5 w-5" aria-hidden="true"/>
                </Menu.Button>
            </div>

            <Transition
                as={Fragment}
                enter="transition ease-out duration-100"
                enterFrom="transform opacity-0 scale-95"
                enterTo="transform opacity-100 scale-100"
                leave="transition ease-in duration-75"
                leaveFrom="transform opacity-100 scale-100"
                leaveTo="transform opacity-0 scale-95"
            >
                <Menu.Items
                    className="origin-top-left w-56 absolute mt-2 rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5 focus:outline-none">
                    <div className="py-1">
                        {
                            tokensAvailable
                                .map((token, i) => {
                                    const amount = props.walletTokens
                                        .filter(wt => wt.address === token.token.address && wt.chainId === token.token.chainId)
                                        [0]?.amount.toFixed(3).slice(0, -1) || "0";
                                    return <Menu.Item key={i} onClick={() => props.onClick(token.token)}>
                                        {({active}) => (
                                            <a
                                                key={token.token.address}
                                                href="#"
                                                className={classNames(
                                                    active ? 'bg-gray-100 text-gray-900' : 'text-gray-700',
                                                    'block px-4 py-2 text-sm'
                                                )}
                                            >
                                                {token.token.symbol} - {amount}
                                            </a>
                                        )}
                                    </Menu.Item>
                                })
                        }
                    </div>
                </Menu.Items>
            </Transition>
        </Menu>
    )
}