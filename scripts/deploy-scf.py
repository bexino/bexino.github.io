import base64
import os
import sys
import time
from pathlib import Path

from tencentcloud.common import credential
from tencentcloud.scf.v20180416 import models, scf_client

def main():
    secret_id = os.environ.get("TENCENT_SECRET_ID")
    secret_key = os.environ.get("TENCENT_SECRET_KEY")
    if not secret_id or not secret_key:
        raise RuntimeError("缺少腾讯云密钥，请检查 GitHub Actions secrets")
    function_name = os.environ.get("SCF_FUNCTION_NAME", "").strip()
    namespace = os.environ.get("SCF_NAMESPACE", "").strip()
    region = os.environ.get("SCF_REGION", "").strip()
    if not all((function_name, namespace, region)):
        raise RuntimeError("缺少 SCF_FUNCTION_NAME、SCF_NAMESPACE 或 SCF_REGION，请配置部署目标")
    if len(sys.argv) != 2:
        raise RuntimeError("用法：python scf/deploy.py scf.zip")
    package = Path(sys.argv[1]).read_bytes()
    if len(package) > 20 * 1024 * 1024:
        raise RuntimeError("代码包超过 SCF 接口 20 MB 限制")

    client = scf_client.ScfClient(credential.Credential(secret_id, secret_key), region)
    query = models.GetFunctionRequest()
    query.FunctionName = function_name
    query.Namespace = namespace
    before = client.GetFunction(query)
    if before.Type != "HTTP" or before.Runtime != "Nodejs16.13":
        raise RuntimeError(f"目标函数类型或运行时不匹配：{before.Type} / {before.Runtime}")
    if before.Status != "Active":
        raise RuntimeError(f"函数状态不是 Active：{before.Status} {before.StatusDesc}")
    print(f"准备更新 {region}/{namespace}/{function_name}", flush=True)

    request = models.UpdateFunctionCodeRequest()
    request.FunctionName = function_name
    request.Namespace = namespace
    request.ZipFile = base64.b64encode(package).decode("ascii")
    request.Publish = "FALSE"
    response = client.UpdateFunctionCode(request)
    print(f"更新请求已提交，RequestId: {response.RequestId}", flush=True)

    # 给状态变化留出时间，然后等待函数恢复正常。
    time.sleep(10)
    deadline = time.monotonic() + 300
    while time.monotonic() < deadline:
        result = client.GetFunction(query)
        print(f"函数状态：{result.Status} {result.StatusDesc or ''}", flush=True)
        if result.Status == "Active":
            if (result.CodeResult or "").lower() == "failed":
                raise RuntimeError(f"代码更新失败：{result.CodeError}")
            print("云函数代码更新完成", flush=True)
            return
        if result.Status in ("CreateFailed", "UpdateFailed", "DeleteFailed"):
            raise RuntimeError(f"函数更新失败：{result.StatusDesc}")
        time.sleep(5)
    raise TimeoutError("等待云函数更新超时")


if __name__ == "__main__":
    main()

