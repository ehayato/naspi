const { Writable } = require('stream');
const Docker = require('dockerode');

const docker = new Docker({ socketPath: '/var/run/docker.sock' });

// 出力が長大になっても、Discordに載せる末尾だけを保持する
const MAX_OUTPUT_CHARS = 4000;

// 実行中のコンテナ内でコマンドを実行し、終了コードと標準出力・標準エラー（末尾）を返す
async function dockerExec(containerName, cmd) {
  const container = docker.getContainer(containerName);
  const exec = await container.exec({
    Cmd: cmd,
    AttachStdout: true,
    AttachStderr: true
  });
  const stream = await exec.start({ hijack: true, stdin: false });

  let output = '';
  const sink = new Writable({
    write(chunk, _encoding, callback) {
      output = (output + chunk.toString()).slice(-MAX_OUTPUT_CHARS);
      callback();
    }
  });
  container.modem.demuxStream(stream, sink, sink);

  await new Promise((resolve, reject) => {
    stream.on('end', resolve);
    stream.on('error', reject);
  });

  const { ExitCode } = await exec.inspect();
  return { exitCode: ExitCode, output: output.trim() };
}

module.exports = {
  dockerExec
};
