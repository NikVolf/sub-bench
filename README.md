# sub-bench

You can use this bench tool to run against `substrate --dev` node. No configuration needed!

Having your substrate started in `--dev` mode with default websockets config, run here

```
npm install
npx tsc
node dist/index.js
```

or just if already npm-installed & compiled

```
node dist/index.js
```

### some configuration

You can change how long will it spam transactions in bench.config.json:

`processedTransactions = 1000`

replace it with any number to spam more/less

In the same file, you can change how much is spammed per seccond:

`tps = 100`

websockets url is set in `polkadot.bench.config.json`

### kudos

thanks for @mixbytes and their tank project which actually runs those configured benchmarks
