from fastapi import APIRouter


router = APIRouter(
    prefix="/companies",
    tags=["Companies"],
)


@router.get("/")
def get_companies():
    return {
        "message": "Company API is working"
    }