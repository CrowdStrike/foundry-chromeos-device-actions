# pylint: disable=missing-module-docstring,missing-function-docstring
import json
import uuid
from logging import Logger
from crowdstrike.foundry.function import Function, Request, Response, APIError
from falconpy import CustomStorage, APIIntegrations

# pylint: disable=invalid-name
func = Function.instance()

SETTINGS_COLLECTION_NAME = "settings"
DEFINITION_NAME = "chromeos-api"
MOVE_DEVICE_OP_NAME = "ChromeOS - Move Device to OU"


@func.handler(method="POST", path="/move_chromeos_device")
def move_chromeos_device(request: Request, logger: Logger) -> Response:
    logger.info("Processing request to move ChromeOS device")
    # Extract parameters from request body
    device_id = request.body.get("device_id")
    ou_path = request.body.get("ou_path")

    # Validate required parameters
    if not device_id or not ou_path:
        logger.error("Missing required parameters")
        return Response(
            code=400,
            errors=[
                APIError(
                    code=400,
                    message=(
                        "Missing required parameters: device_id and ou_path "
                        "are required"
                    ),
                )
            ],
        )

    # Grab customer ID and validate
    customer_id = get_customer_id()
    if not customer_id:
        error_msg = "Failed to retrieve customer ID from settings collection"
        logger.error(error_msg)
        return Response(
            code=400,
            errors=[
                APIError(
                    code=400,
                    message=(error_msg),
                )
            ],
        )

    # Make API Integration call to Move Device
    falcon_api_int = APIIntegrations()
    try:
        falcon_api_int.execute_command(
            definition_id=DEFINITION_NAME,
            operation_id=MOVE_DEVICE_OP_NAME,
            path={
                "customerId": customer_id,
            },
            query={
                "orgUnitPath": ou_path,
            },
            data={
                "deviceIds": [convert_device_id(device_id)]
            }
        )
    # pylint: disable=broad-exception-caught
    except Exception as e:
        logger.error(f"Error moving ChromeOS device: {e}")
        return Response(
            code=500,
            errors=[
                APIError(
                    code=500,
                    message=f"Failed to move ChromeOS device: {str(e)}",
                )
            ],
        )

    return Response(
        code=200,
        body={
            "status": "OK",
            "message": "Device moved successfully"
        },
    )


def get_customer_id() -> str:
    """Return Chrome Customer ID from settings collection

    Args:
        None

    Returns:
        str: The customer ID string if found, empty string otherwise.
    """
    falcon_custom_storage = CustomStorage()

    key = "all"

    response = falcon_custom_storage.GetObject(
        collection_name=SETTINGS_COLLECTION_NAME, object_key=key
    )

    results = json.loads(response.decode("utf-8"))

    return results.get("customer_id", "")


def convert_device_id(device_id: str) -> str:
    """Convert and return the device ID to the format required

    Args:
        device_id: The device ID to convert.

    Returns:
        The converted device ID.
    """
    return str(uuid.UUID(hex=device_id))


if __name__ == "__main__":
    func.run()
