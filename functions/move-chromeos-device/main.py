# pylint: disable=missing-module-docstring,missing-function-docstring
# flake8: noqa
import json
import uuid
from logging import Logger
from typing import Dict, Any
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
        err_msg = "Missing required parameters: device_id and ou_path"
        return create_error_response(400, err_msg)

    # Grab customer ID and validate
    customer_id = get_customer_id()
    if not customer_id:
        err_msg = "Failed to retrieve customer ID from settings collection"
        logger.error(err_msg)
        return create_error_response(400, err_msg)

    # Make API Integration call to Move Device
    falcon_api_int = APIIntegrations()
    response = falcon_api_int.execute_command(
        definition_id=DEFINITION_NAME,
        operation_id=MOVE_DEVICE_OP_NAME,
        path={
            "customerId": customer_id,
        },
        query={
            "orgUnitPath": ou_path,
        },
        data={"deviceIds": [convert_device_id(device_id)]},
    )

    # Check if response contains an error
    if isinstance(response, dict) and "error" in response:
        error_data = response.get("error", {})
        error_code = error_data.get("code", 500)
        error_message = extract_error_message(error_data)
        logger.error(f"API returned an error: {error_message}")
        return create_error_response(error_code, error_message)

    # If we got here, the operation was successful
    return Response(
        code=200,
        body={
            "status": "OK",
            "message": "Device moved successfully"
        },
    )


def extract_error_message(error_data: Dict[str, Any]) -> str:
    """Extract a meaningful error message from error data.

    Args:
        error_data: Dictionary containing error information

    Returns:
        A string with the most specific error message available
    """
    # First check for specific errors in the errors array
    if "errors" in error_data and error_data["errors"]:
        err = error_data["errors"][0]
        if "message" in err:
            return err["message"]
        if "reason" in err:
            return f"Error reason: {err['reason']}"

    # Fall back to the main message
    if "message" in error_data:
        return error_data["message"]

    # Last resort
    return "Unknown error occurred"


def create_error_response(code: int, message: str) -> Response:
    """Create an error response with the given code and message.

    Args:
        code: HTTP status code
        message: Error message

    Returns:
        Response: API error response
    """
    return Response(
        code=code,
        errors=[
            APIError(
                code=code,
                message=message,
            )
        ],
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
