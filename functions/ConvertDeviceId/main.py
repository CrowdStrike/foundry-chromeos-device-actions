from crowdstrike.foundry.function import APIError, Function, Request, Response
from typing import Dict
import uuid

func = Function.instance()


@func.handler(method="POST", path="/convert_host_id")
def convert_host_id(request: Request, config: [Dict[str, any], None]) -> Response:
    device_id = request.body.get("host_id")
    body = {"device_id": str(uuid.UUID(hex=device_id))}
    return Response(
        body=body,
        code=200,
    )


if __name__ == "__main__":
    func.run()
