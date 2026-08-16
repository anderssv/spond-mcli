export async function convertFileToText(
  command: string,
  fileType: string,
  inputPath: string,
  outputPath: string,
  installHint: string
): Promise<string> {
  const { spawn } = await import('child_process');
  const { promises: fs } = await import('fs');

  try {
    await fs.access(inputPath);
  } catch {
    throw new Error(`Input ${fileType} file not found: ${inputPath}`);
  }

  return new Promise((resolve, reject) => {
    const process = spawn(command, [inputPath, outputPath]);

    let errorOutput = '';

    process.stderr.on('data', (data) => {
      errorOutput += data.toString();
    });

    process.on('close', async (code) => {
      if (code === 0) {
        try {
          await fs.access(outputPath);
          resolve(`Successfully converted ${fileType} to text. Output saved to: ${outputPath}`);
        } catch {
          reject(new Error(`${fileType} conversion completed but output file not found: ${outputPath}`));
        }
      } else {
        reject(new Error(`${command} failed with exit code ${code}. Error: ${errorOutput}`));
      }
    });

    process.on('error', (error) => {
      reject(new Error(`Failed to start ${command} command: ${error.message}. ${installHint}`));
    });
  });
}
