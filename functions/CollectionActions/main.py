from crowdstrike.foundry.function import APIError, Function, Request, Response
from typing import Dict
from falconpy import CustomStorage
import json

func = Function.instance()

COLLECTION_NAME = "chromeos_device_original_ou_collection"


@func.handler(method="PUT", path="/add_ou_to_collection")
def add_ou_to_collection(request: Request, config: [Dict[str, any], None]) -> Response:

    falcon_custom_storage = CustomStorage()

    host_id = request.body.get("host_id")
    existing_ou_id = request.body.get("existing_ou_id")

    # in case wrong Id is used, strip all hyphens
    host_id = host_id.replace("-", "")
    # make sure 'id:' prefix is added to ou id
    existing_ou_id = f"id:{existing_ou_id.replace('id:', '')}"

    data = {"original-ou-path": existing_ou_id}

    response = falcon_custom_storage.PutObject(collection_name=COLLECTION_NAME, body=data, object_key=host_id)

    body = {"status": "OK", "message": str(response)}

    return Response(
        body=body,
        code=200,
    )


@func.handler(method="GET", path="/get_ou_from_collection")
def get_ou_from_collection(request: Request, config: [Dict[str, any], None]) -> Response:

    falcon_custom_storage = CustomStorage()

    host_id = request.body.get("host_id")

    # in case wrong Id is used, strip all hyphens
    host_id = host_id.replace("-", "")

    response = falcon_custom_storage.GetObject(collection_name=COLLECTION_NAME, object_key=host_id)
    response = json.loads(response.decode("utf-8"))

    body = {"original_ou_id": response["original-ou-path"]}

    return Response(
        body=body,
        code=200,
    )


if __name__ == "__main__":
    func.run()
