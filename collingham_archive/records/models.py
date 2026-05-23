from django.db import models

class Record(models.Model):
    STATUS_CHOICES = [
        ('draft', 'Draft'),
        ('published', 'Published'),
        ('archived', 'Archived'),
    ]
    CONDITION_CHOICES = [
        ('new', 'New'),
        ('good', 'Good'),
        ('fair', 'Fair'),
        ('poor', 'Poor'),
    ]

    simple_object_name = models.CharField(max_length=255)
    title = models.CharField(max_length=255)
    brief_description = models.TextField()
    donated_loan_by = models.CharField(max_length=255)
    copyright = models.CharField(max_length=255)
    associated_people = models.TextField()
    associated_places = models.TextField()
    home_location = models.CharField(max_length=255, default="Jubilee Room")  # Set default value
    date_received = models.DateField()
    current_location = models.CharField(max_length=255)
    physical_description = models.TextField()
    size = models.CharField(max_length=255)
    condition = models.CharField(max_length=255, choices=CONDITION_CHOICES)
    status = models.CharField(max_length=255, choices=STATUS_CHOICES)
    notes = models.TextField()
    id_number = models.CharField(max_length=255, unique=True)

    def __str__(self):
        return self.title
