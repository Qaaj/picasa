FROM python:3.10-slim

WORKDIR /app

RUN pip install flask requests jsonpickle numpy

COPY passthru.py .

EXPOSE 7777

CMD ["python", "passthru.py"]
