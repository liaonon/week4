import detectEthereumProvider from "@metamask/detect-provider"
import { Strategy, ZkIdentity } from "@zk-kit/identity"
import { generateMerkleProof, Semaphore } from "@zk-kit/protocols"
import { providers, Contract, utils } from "ethers"
import Head from "next/head"
import React, {useEffect ,useState} from "react"
import styles from "../styles/Home.module.css"

import * as yup from "yup";
import TextField from "@mui/material/TextField"
import Button from "@mui/material/Button"
import { useForm } from "react-hook-form"
import { Stack } from "@mui/material"
import { yupResolver } from '@hookform/resolvers/yup';
import Greeter from 'artifacts/contracts/Greeters.sol/Greeters.json'


const users = yup.object({
    Name: yup.string().required(),
    Age: yup.number().positive().integer().required(),
    Address: yup.string().matches(/^0x[a-f0-9]{40}$/i).required(),
  }).required();

export default function Home() {
    const [logs, setLogs] = useState("Connect your wallet and greet!")
    const [greets, setGreets] = useState("")
    const [greeting, setGreeting] = useState("")


    useEffect(() => {
        const provider2 = new providers.JsonRpcProvider("http://localhost:8545")
        const contract = new Contract("0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512", Greeter.abi, provider2)

        contract.on("NewGreeting", (res) => {
            const greetout = utils.parseBytes32String(res)
            setGreets(greetout)
        })
        
    }, [])

    async function greet() {
        setLogs("Creating your Semaphore identity...")

        const provider = (await detectEthereumProvider()) as any

        await provider.request({ method: "eth_requestAccounts" })

        const ethersProvider = new providers.Web3Provider(provider)
        const signer = ethersProvider.getSigner()
        const message = await signer.signMessage("Sign this message to create your identity!")

        const identity = new ZkIdentity(Strategy.MESSAGE, message)
        const identityCommitment = identity.genIdentityCommitment()
        const identityCommitments = await (await fetch("./identityCommitments.json")).json()

        const merkleProof = generateMerkleProof(20, BigInt(0), identityCommitments, identityCommitment)

        setGreeting("Hello world")

        const witness = Semaphore.genWitness(
            identity.getTrapdoor(),
            identity.getNullifier(),
            merkleProof,
            merkleProof.root,
            greeting
        )

        const { proof, publicSignals } = await Semaphore.genProof(witness, "./semaphore.wasm", "./semaphore_final.zkey")
        const solidityProof = Semaphore.packToSolidityProof(proof)

        const response = await fetch("/api/greet", {
            method: "POST",
            body: JSON.stringify({
                greeting,
                nullifierHash: publicSignals.nullifierHash,
                solidityProof: solidityProof
            })
        })

        if (response.status === 500) {
            const errorMessage = await response.text()

            setLogs(errorMessage)
        } else {
            setLogs("Your anonymous greeting is onchain :)")
        }
    }


    const { register, handleSubmit, formState:{ errors } } = useForm({
        resolver: yupResolver(users)
    });



    return (
        <div className={styles.container}>
            <Head>
                <title>Greetings</title>
                <meta name="description" content="A simple Next.js/Hardhat privacy application with Semaphore." />
                <link rel="icon" href="/favicon.ico" />
            </Head>

            <main className={styles.main}>
                <h1 className={styles.title}>Greetings</h1>

                <p className={styles.description}>A simple Next.js/Hardhat privacy application with Semaphore.</p>

                <div className={styles.logs}>{logs}</div>

                

                <form onSubmit={handleSubmit((data) => {
                    console.log(data);
                })}>
                    <Stack>
                        <TextField {...register("Name")} label="Name" variant="standard" />
                        <p>{errors.Name?.message}</p>
                        <TextField {...register("Age")} label="Age" variant="standard" />
                        <p>{errors.Age?.message}</p>
                        <TextField {...register("Address")} label="Address" variant="standard" />
                        <p>{errors.Address?.message}</p>
                        <TextField type="submit" />
                    </Stack>
                </form>
                <Stack>
                    <TextField type="text" placeholder="Input Your Greet text" value={greeting} onChange={(input) => { setGreeting(input.target.value) }} margin="normal" color="secondary" focused/>
                    <Button onClick={() => greet()} className={styles.button} >
                    Greet
                    </Button>

                    <h2>Here are the Greets</h2>
                    
                    <ul>{greets}</ul>
                </Stack>

            </main>
        </div>
    )
}
