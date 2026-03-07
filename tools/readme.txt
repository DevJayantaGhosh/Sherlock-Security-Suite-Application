pip install semgrep --target "./tools/win/semgrep" --upgrade --no-cache-dir

cd tools/win/semgrep
python -m semgrep --version
cd ../../..


pip3 install semgrep --target "./tools/darwin/semgrep" --upgrade --no-cache-dir
chmod +x ./tools/darwin/semgrep/semgrep/bin/semgrep-core


pip3 install semgrep --target "./tools/linux/semgrep" --upgrade --no-cache-dir
chmod +x ./tools/linux/semgrep/semgrep/bin/semgrep-core

