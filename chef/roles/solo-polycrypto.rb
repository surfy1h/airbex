name "solo-polycrypto"
run_list(
  "role[base]",
  "role[pgm]",
  "role[frontend]",
  "role[admin]",
  "role[landing]",
  "role[api]",
  "role[reverse]",
  "role[bitcoind]",
  "role[litecoind]",
  "role[dogecoind]",
  "role[workers]",
  "recipe[snow::aws_eip]"
)
